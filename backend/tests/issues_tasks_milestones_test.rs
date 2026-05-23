mod common;

use serde_json::json;

#[tokio::test]
async fn test_issues_crud() {
    let pool = common::setup_db().await;
    let (admin_id, admin_token) = common::create_admin(&pool).await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;
    common::add_project_member(&pool, project_id, admin_id, "manager").await;
    let router = common::build_test_router(pool);

    // 1. Create issue
    let resp = common::post_json(router.clone(), "/api/issues", json!({
        "project_id": project_id,
        "subject": "Test Issue"
    }), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
    let issue_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // 2. List issues by project
    let resp = common::get(router.clone(), &format!("/api/issues?project_id={}", project_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 3. Get issue by id
    let resp = common::get(router.clone(), &format!("/api/issues/{}", issue_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 4. Update issue
    let resp = common::put_json(router.clone(), &format!("/api/issues/{}", issue_id), json!({
        "subject": "Updated Issue"
    }), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 5. Delete issue
    let resp = common::delete(router.clone(), &format!("/api/issues/{}", issue_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_tasks_crud() {
    let pool = common::setup_db().await;
    let (admin_id, admin_token) = common::create_admin(&pool).await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;
    common::add_project_member(&pool, project_id, admin_id, "manager").await;
    let router = common::build_test_router(pool);

    // 6. Create task
    let resp = common::post_json(router.clone(), "/api/tasks", json!({
        "project_id": project_id,
        "title": "Test Task"
    }), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
    let task_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // 7. List tasks by project
    let resp = common::get(router.clone(), &format!("/api/tasks?project_id={}", project_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 8. Update task
    let resp = common::put_json(router.clone(), &format!("/api/tasks/{}", task_id), json!({
        "title": "Updated Task"
    }), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 9. Delete task
    let resp = common::delete(router.clone(), &format!("/api/tasks/{}", task_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_milestones_crud() {
    let pool = common::setup_db().await;
    let (admin_id, admin_token) = common::create_admin(&pool).await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;
    common::add_project_member(&pool, project_id, admin_id, "manager").await;
    let router = common::build_test_router(pool);

    // 10. Create milestone
    let resp = common::post_json(router.clone(), "/api/milestones", json!({
        "project_id": project_id,
        "name": "Test Milestone"
    }), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
    let milestone_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // 11. Update milestone
    let resp = common::put_json(router.clone(), &format!("/api/milestones/{}", milestone_id), json!({
        "name": "Updated Milestone"
    }), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // 12. Delete milestone
    let resp = common::delete(router.clone(), &format!("/api/milestones/{}", milestone_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_auth_scenarios() {
    let pool = common::setup_db().await;
    let (_user_id, user_token) = common::create_user(&pool, "member", "user").await;
    let project_id = common::create_project(&pool, "Test Project", "TP").await;
    // No member access
    let router = common::build_test_router(pool);

    // 13. Non-member access
    let resp = common::post_json(router.clone(), "/api/issues", json!({
        "project_id": project_id,
        "subject": "Test Issue"
    }), Some(&user_token)).await;
    assert_eq!(common::status(&resp), 403);

    // 14. No token
    let resp = common::get(router.clone(), "/api/issues", None).await;
    assert_eq!(common::status(&resp), 401);
}
