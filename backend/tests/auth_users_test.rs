mod common;

use serde_json::json;
use common::{setup_db, build_test_router, create_admin, create_user, get, post_json, put_json, delete, body_json, status};

#[tokio::test]
async fn test_auth_register_success() {
    let pool = setup_db().await;
    let router = build_test_router(pool);

    let body = json!({
        "login": "newuser",
        "email": "newuser@test.com",
        "password": "password123",
        "firstname": "New",
        "lastname": "User"
    });

    let resp = post_json(router.clone(), "/api/auth/register", body, None).await;
    assert_eq!(status(&resp), 200, "Registration should succeed");

    let json = body_json(resp).await;
    assert_eq!(json["success"], true);
    assert!(json["uuid"].is_string());
}

#[tokio::test]
async fn test_auth_login_success() {
    let pool = setup_db().await;
    let router = build_test_router(pool);
    
    // Register first
    let register_body = json!({
        "login": "loginuser",
        "email": "loginuser@test.com",
        "password": "password123"
    });
    post_json(router.clone(), "/api/auth/register", register_body, None).await;

    // Login
    let login_body = json!({
        "login": "loginuser",
        "password": "password123"
    });
    let resp = post_json(router.clone(), "/api/auth/login", login_body, None).await;
    assert_eq!(status(&resp), 200, "Login should succeed");

    let json = body_json(resp).await;
    assert_eq!(json["success"], true);
    assert!(json["token"].is_string());
}

#[tokio::test]
async fn test_auth_login_wrong_password() {
    let pool = setup_db().await;
    let router = build_test_router(pool);
    
    // Register
    let register_body = json!({
        "login": "wrongpass",
        "email": "wrongpass@test.com",
        "password": "password123"
    });
    post_json(router.clone(), "/api/auth/register", register_body, None).await;

    // Login with wrong password
    let login_body = json!({
        "login": "wrongpass",
        "password": "wrongpassword"
    });
    let resp = post_json(router.clone(), "/api/auth/login", login_body, None).await;
    assert_eq!(status(&resp), 401, "Login with wrong password should fail");
}

#[tokio::test]
async fn test_auth_login_nonexistent_user() {
    let pool = setup_db().await;
    let router = build_test_router(pool);
    
    let login_body = json!({
        "login": "nonexistent",
        "password": "password123"
    });
    let resp = post_json(router.clone(), "/api/auth/login", login_body, None).await;
    assert_eq!(status(&resp), 401, "Login with non-existent user should fail");
}

#[tokio::test]
async fn test_auth_register_duplicate() {
    let pool = setup_db().await;
    let router = build_test_router(pool);
    
    let body = json!({
        "login": "dupuser",
        "email": "dupuser@test.com",
        "password": "password123"
    });
    post_json(router.clone(), "/api/auth/register", body.clone(), None).await;
    
    // Try to register again
    let resp = post_json(router.clone(), "/api/auth/register", body, None).await;
    assert_eq!(status(&resp), 409, "Registering duplicate user should fail");
}

#[tokio::test]
async fn test_users_list_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_admin(&pool).await;
    
    let resp = get(router.clone(), "/api/users", Some(&token)).await;
    assert_eq!(status(&resp), 200);
    
    let json = body_json(resp).await;
    assert!(json["data"].is_array());
}

#[tokio::test]
async fn test_users_list_non_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_user(&pool, "normaluser", "user").await;
    
    let resp = get(router.clone(), "/api/users", Some(&token)).await;
    // Depending on implementation, it might be 200 (if they can list themselves/others) or 403.
    // The prompt says "200 or 403". Let's assume 403 for now as it's a protected resource.
    // Actually, let's check the status code.
    let s = status(&resp);
    assert!(s == 200 || s == 403, "List users should be 200 or 403 for non-admin");
}

#[tokio::test]
async fn test_users_get_by_id_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (admin_id, token) = create_admin(&pool).await;
    
    let resp = get(router.clone(), &format!("/api/users/{}", admin_id), Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_users_get_nonexistent() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_admin(&pool).await;
    
    let resp = get(router.clone(), "/api/users/9999", Some(&token)).await;
    assert_eq!(status(&resp), 404);
}

#[tokio::test]
async fn test_users_create_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_admin(&pool).await;
    
    let body = json!({
        "login": "newuser",
        "email": "newuser@test.com",
        "password": "password123",
        "role": "user"
    });
    let resp = post_json(router.clone(), "/api/users", body, Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_users_create_non_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, token) = create_user(&pool, "normaluser", "user").await;
    
    let body = json!({
        "login": "newuser",
        "email": "newuser@test.com",
        "password": "password123",
        "role": "user"
    });
    let resp = post_json(router.clone(), "/api/users", body, Some(&token)).await;
    assert_eq!(status(&resp), 403);
}

#[tokio::test]
async fn test_users_update_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (admin_id, token) = create_admin(&pool).await;
    
    let body = json!({
        "email": "newadminemail@test.com"
    });
    let resp = put_json(router.clone(), &format!("/api/users/{}", admin_id), body, Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_users_delete_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, admin_token) = create_admin(&pool).await;
    let (user_id, _) = create_user(&pool, "todelete", "user").await;
    
    let resp = delete(router.clone(), &format!("/api/users/{}", user_id), Some(&admin_token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_users_delete_non_admin() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (_, user_token) = create_user(&pool, "normaluser", "user").await;
    let (target_id, _) = create_user(&pool, "target", "user").await;
    
    let resp = delete(router.clone(), &format!("/api/users/{}", target_id), Some(&user_token)).await;
    assert_eq!(status(&resp), 403);
}

#[tokio::test]
async fn test_users_change_password() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    let (user_id, token) = create_user(&pool, "passuser", "user").await;
    
    let body = json!({
        "password": "newpassword123"
    });
    let resp = post_json(router.clone(), &format!("/api/users/{}/password", user_id), body, Some(&token)).await;
    assert_eq!(status(&resp), 200);
}

#[tokio::test]
async fn test_users_no_token() {
    let pool = setup_db().await;
    let router = build_test_router(pool.clone());
    
    let resp = get(router.clone(), "/api/users", None).await;
    assert_eq!(status(&resp), 401);
}
