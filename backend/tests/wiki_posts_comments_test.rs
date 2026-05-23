mod common;

use serde_json::json;

#[tokio::test]
async fn test_wiki_crud() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_admin_id, admin_token) = common::create_admin(&pool).await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;

    // 1. Create wiki page (admin global)
    let resp = common::post_json(router.clone(), "/api/wiki", json!({"title": "Global Wiki", "content": "Content"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 2. Create wiki page (project)
    let resp = common::post_json(router.clone(), "/api/wiki", json!({"project_id": project_id, "title": "Project Wiki", "content": "Content"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 3. List wiki pages
    let resp = common::get(router.clone(), "/api/wiki", Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 4. Update wiki page
    let wiki_id = 1; // Assuming first one
    let resp = common::put_json(router.clone(), &format!("/api/wiki/{}", wiki_id), json!({"title": "Updated Title", "content": "Updated Content"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 5. Delete wiki page
    let resp = common::delete(router.clone(), &format!("/api/wiki/{}", wiki_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 6. Wiki version history
    let resp = common::get(router.clone(), &format!("/api/wiki/{}/versions", wiki_id), Some(&admin_token)).await;
    // Might be 200 or 404 depending on if it exists
    assert!(common::status(&resp) == 200 || common::status(&resp) == 404);
}

#[tokio::test]
async fn test_posts_crud() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_admin_id, admin_token) = common::create_admin(&pool).await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;

    // 7. Create post
    let resp = common::post_json(router.clone(), "/api/posts", json!({"project_id": project_id, "title": "Post Title", "content": "Post Content", "category": "general"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
    let post_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // 8. List posts
    let resp = common::get(router.clone(), "/api/posts", Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 9. Update post
    let resp = common::put_json(router.clone(), &format!("/api/posts/{}", post_id), json!({"title": "Updated Post Title", "content": "Updated Post Content", "category": "general"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 10. Delete post
    let resp = common::delete(router.clone(), &format!("/api/posts/{}", post_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_post_comments_crud() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (admin_id, admin_token) = common::create_admin(&pool).await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;
    let post_id = common::create_post(&pool, Some(project_id), "Post", admin_id).await;

    // 11. Post comments CRUD
    // Create
    let resp = common::post_json(router.clone(), &format!("/api/posts/{}/comments", post_id), json!({"content": "Comment"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
    let comment_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // List
    let resp = common::get(router.clone(), &format!("/api/posts/{}/comments", post_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // Update
    let resp = common::put_json(router.clone(), &format!("/api/posts/comments/{}", comment_id), json!({"content": "Updated Comment"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // Delete
    let resp = common::delete(router.clone(), &format!("/api/posts/comments/{}", comment_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_issue_comments_crud() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_admin_id, admin_token) = common::create_admin(&pool).await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;
    let issue_id = common::create_issue(&pool, project_id, "Issue").await;

    // 12. Issue comments CRUD
    // Create
    let resp = common::post_json(router.clone(), &format!("/api/issues/{}/comments", issue_id), // 프런트엔드는 대상 이슈를 경로로만 전달하므로 본문에 issue_id 를 넣지 않습니다.
        json!({"content": "Comment"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
    let comment_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // List
    let resp = common::get(router.clone(), &format!("/api/issues/{}/comments", issue_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // Update
    let resp = common::put_json(router.clone(), &format!("/api/issues/comments/{}", comment_id), json!({"content": "Updated Comment"}), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // Delete
    let resp = common::delete(router.clone(), &format!("/api/issues/comments/{}", comment_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_unauthorized_access() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (admin_id, admin_token) = common::create_admin(&pool).await;
    let (_user_id, user_token) = common::create_user(&pool, "user", "user").await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;
    let post_id = common::create_post(&pool, Some(project_id), "Post", admin_id).await;

    // 13. Non-owner comment update
    // Create comment as admin
    let resp = common::post_json(router.clone(), &format!("/api/posts/{}/comments", post_id), json!({"content": "Admin Comment"}), Some(&admin_token)).await;
    let comment_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // Try update as user
    let resp = common::put_json(router.clone(), &format!("/api/posts/comments/{}", comment_id), json!({"content": "Hacked Comment"}), Some(&user_token)).await;
    assert_eq!(common::status(&resp), 403);

    // 14. No token
    let resp = common::get(router.clone(), "/api/posts", None).await;
    assert_eq!(common::status(&resp), 401);
}
