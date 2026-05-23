mod common;

use common::*;
use serde_json::json;

#[tokio::test]
async fn test_list_projects() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_admin(&pool).await;

    let resp = get(router.clone(), "/api/projects", Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_create_project() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_admin(&pool).await;

    let body = json!({
        "name": "Test Project",
        "identifier": "test-project"
    });
    let resp = post_json(router.clone(), "/api/projects", body, Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_get_project_by_id() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_admin(&pool).await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;

    let resp = get(router.clone(), &format!("/api/projects/{}", project_id), Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_update_project() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_admin(&pool).await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;

    let body = json!({
        "name": "Updated Project"
    });
    let resp = put_json(router.clone(), &format!("/api/projects/{}", project_id), body, Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_delete_project_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_admin(&pool).await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;

    let resp = delete(router.clone(), &format!("/api/projects/{}", project_id), Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_delete_project_non_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, _admin_token) = create_admin(&pool).await;
    let (_, user_token) = create_user(&pool, "user", "user").await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;

    let resp = delete(router.clone(), &format!("/api/projects/{}", project_id), Some(&user_token)).await;
    assert_eq!(status(&resp), 403);
}

#[tokio::test]
async fn test_add_member() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, admin_token) = create_admin(&pool).await;
    let (user_id, _) = create_user(&pool, "user", "user").await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;

    let body = json!({
        "user_id": user_id,
        "role": "developer"
    });
    let resp = post_json(router.clone(), &format!("/api/projects/{}/members", project_id), body, Some(&admin_token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_list_members() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, admin_token) = create_admin(&pool).await;
    let (user_id, _) = create_user(&pool, "user", "user").await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;
    add_project_member(&pool, project_id, user_id, "developer").await;

    let resp = get(router.clone(), &format!("/api/projects/{}/members", project_id), Some(&admin_token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_update_member_role() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, admin_token) = create_admin(&pool).await;
    let (user_id, _) = create_user(&pool, "user", "user").await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;
    add_project_member(&pool, project_id, user_id, "developer").await;

    let body = json!({
        "role": "manager"
    });
    let resp = put_json(router.clone(), &format!("/api/projects/{}/members/{}", project_id, user_id), body, Some(&admin_token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_remove_member() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, admin_token) = create_admin(&pool).await;
    let (user_id, _) = create_user(&pool, "user", "user").await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;
    add_project_member(&pool, project_id, user_id, "developer").await;

    let resp = delete(router.clone(), &format!("/api/projects/{}/members/{}", project_id, user_id), Some(&admin_token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_batch_add_members() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, admin_token) = create_admin(&pool).await;
    let (user_id1, _) = create_user(&pool, "user1", "user").await;
    let (user_id2, _) = create_user(&pool, "user2", "user").await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;

    let body = json!({
        "user_ids": [user_id1, user_id2],
        "role": "developer"
    });
    let resp = post_json(router.clone(), &format!("/api/projects/{}/members/batch", project_id), body, Some(&admin_token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_non_member_access() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, admin_token) = create_admin(&pool).await;
    let (_, user_token) = create_user(&pool, "user", "user").await;
    let project_id = create_project(&pool, "Test Project", "test-project").await;

    // Make project private
    let body = json!({"is_public": false});
    put_json(router.clone(), &format!("/api/projects/{}", project_id), body, Some(&admin_token)).await;

    // Assuming non-members cannot access project details
    let resp = get(router.clone(), &format!("/api/projects/{}", project_id), Some(&user_token)).await;
    assert_eq!(status(&resp), 403);
}

#[tokio::test]
async fn test_access_without_token() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let project_id = create_project(&pool, "Test Project", "test-project").await;

    let resp = get(router.clone(), &format!("/api/projects/{}", project_id), None).await;
    assert_eq!(status(&resp), 401);
}
