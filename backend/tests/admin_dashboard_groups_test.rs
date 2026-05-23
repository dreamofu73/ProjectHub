mod common;

use serde_json::json;

#[tokio::test]
async fn test_admin_org_settings() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, admin_token) = common::create_admin(&pool).await;

    // Get settings
    let resp = common::get(router.clone(), "/api/admin/organization/settings", Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // Update settings
    let resp = common::put_json(
        router.clone(),
        "/api/admin/organization/settings",
        json!({"name": "New Org Name"}),
        Some(&admin_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_non_admin_org_settings() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, user_token) = common::create_user(&pool, "user1", "user").await;

    let resp = common::get(router.clone(), "/api/admin/organization/settings", Some(&user_token)).await;
    assert_eq!(common::status(&resp), 403);
}

#[tokio::test]
async fn test_department_crud() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, admin_token) = common::create_admin(&pool).await;

    // Create
    let resp = common::post_json(
        router.clone(),
        "/api/admin/organization/departments",
        json!({"name": "Engineering"}),
        Some(&admin_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);
    let dept = common::body_json(resp).await;
    let dept_id = dept["data"]["id"].as_i64().unwrap();

    // Get
    let resp = common::get(router.clone(), &format!("/api/admin/organization/departments/{}", dept_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // Update
    let resp = common::put_json(
        router.clone(),
        &format!("/api/admin/organization/departments/{}", dept_id),
        json!({"name": "Updated Engineering"}),
        Some(&admin_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);

    // Delete
    let resp = common::delete(router.clone(), &format!("/api/admin/organization/departments/{}", dept_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
#[ignore]
async fn test_admin_logs_level() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, admin_token) = common::create_admin(&pool).await;

    // Get level
    let resp = common::get(router.clone(), "/api/admin/logs/level", Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);

    // Set level
    let resp = common::put_json(
        router.clone(),
        "/api/admin/logs/level",
        json!({"level": "DEBUG"}),
        Some(&admin_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_scheduler_status() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, admin_token) = common::create_admin(&pool).await;

    let resp = common::get(router.clone(), "/api/admin/scheduler", Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_user_groups_crud() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, user_token) = common::create_user(&pool, "user1", "user").await;

    // Create
    let resp = common::post_json(
        router.clone(),
        "/api/chat/user-groups",
        json!({"name": "My Group"}),
        Some(&user_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);
    let group = common::body_json(resp).await;
    let group_id = group["id"].as_i64().unwrap();

    // Update
    let resp = common::put_json(
        router.clone(),
        &format!("/api/chat/user-groups/{}", group_id),
        json!({"name": "Updated Group"}),
        Some(&user_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);

    // Delete
    let resp = common::delete(router.clone(), &format!("/api/chat/user-groups/{}", group_id), Some(&user_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_user_group_members() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, user_token) = common::create_user(&pool, "user1", "user").await;
    let (user2_id, _) = common::create_user(&pool, "user2", "user").await;

    // Create group
    let resp = common::post_json(
        router.clone(),
        "/api/chat/user-groups",
        json!({"name": "My Group"}),
        Some(&user_token),
    )
    .await;
    let group_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // Add member
    let resp = common::post_json(
        router.clone(),
        &format!("/api/chat/user-groups/{}/members", group_id),
        json!({"user_ids": [user2_id]}),
        Some(&user_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);

    // List members
    let resp = common::get(router.clone(), &format!("/api/chat/user-groups/{}/members", group_id), Some(&user_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_groups_crud() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, admin_token) = common::create_admin(&pool).await;

    // Create
    let resp = common::post_json(
        router.clone(),
        "/api/groups",
        json!({"name": "Global Group"}),
        Some(&admin_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);
    let group_id = common::body_json(resp).await["id"].as_i64().unwrap();

    // Update
    let resp = common::put_json(
        router.clone(),
        &format!("/api/groups/{}", group_id),
        json!({"name": "Updated Global Group"}),
        Some(&admin_token),
    )
    .await;
    assert_eq!(common::status(&resp), 200);

    // Delete
    let resp = common::delete(router.clone(), &format!("/api/groups/{}", group_id), Some(&admin_token)).await;
    assert_eq!(common::status(&resp), 200);
}

#[tokio::test]
async fn test_dashboard() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());
    let (_, user_token) = common::create_user(&pool, "user1", "user").await;

    // Dashboard
    let resp = common::get(router.clone(), "/api/dashboard", Some(&user_token)).await;
    assert_eq!(common::status(&resp), 200);

}

#[tokio::test]
async fn test_no_token() {
    let pool = common::setup_db().await;
    let router = common::build_test_router(pool.clone());

    let resp = common::get(router.clone(), "/api/dashboard", None).await;
    assert_eq!(common::status(&resp), 401);
}
