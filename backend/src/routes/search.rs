use axum::{
    extract::{Extension, Query},
    response::Json,
    http::StatusCode,
    routing::get,
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Expr, ExprTrait, JoinType, Query as SeaQuery};
use std::collections::HashMap;
use crate::auth::AuthUser;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/search", get(search)),
    )
}

async fn search(
    _user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let query_str = params.get("q").cloned().unwrap_or_default();
    if query_str.trim().is_empty() {
        return Ok(Json(json!({ "success": true, "data": { "issues": [], "projects": [], "wiki": [] } })));
    }

    let search_type = params.get("type").cloned().unwrap_or_else(|| "all".to_string());
    let like = format!("%{}%", query_str);
    let mut results = json!({ "issues": [], "projects": [], "wiki": [] });

    if search_type == "all" || search_type == "issues" {
        // 검색어가 정수면 이슈 번호로도 매칭합니다.
        // (`CAST(id AS TEXT)` 는 MySQL 에서 무효한 구문이라 캐스팅 대신 파싱으로 처리합니다.)
        let mut condition = Expr::col(("i", "subject"))
            .like(like.clone())
            .or(Expr::col(("i", "description")).like(like.clone()));
        if let Ok(issue_id) = query_str.trim().parse::<i64>() {
            condition = condition.or(Expr::col(("i", "id")).eq(issue_id));
        }

        let stmt = SeaQuery::select()
            .columns([
                ("i", "id"),
                ("i", "subject"),
                ("i", "status"),
                ("i", "tracker"),
                ("i", "priority"),
                ("i", "updated_at"),
            ])
            .expr_as(Expr::col(("p", "name")), "project_name")
            .expr_as(Expr::col(("p", "identifier")), "project_identifier")
            .from_as("issues", "i")
            .join_as(
                JoinType::InnerJoin,
                "projects",
                "p",
                Expr::col(("p", "id")).equals(("i", "project_id")),
            )
            .and_where(condition)
            .limit(10)
            .to_owned();

        let issues = crate::db::fetch_all(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        results["issues"] = json!(issues.into_iter().map(|r| {
            json!({
                "id": r.get::<i64, _>("id").to_string(),
                "subject": r.get::<String, _>("subject"),
                "status": r.get::<String, _>("status"),
                "tracker": r.get::<String, _>("tracker"),
                "priority": r.get::<String, _>("priority"),
                "project_name": r.get::<String, _>("project_name"),
                "project_identifier": r.get::<String, _>("project_identifier"),
                "updated_at": r.get::<String, _>("updated_at")
            })
        }).collect::<Vec<Value>>());
    }

    if search_type == "all" || search_type == "projects" {
        let stmt = SeaQuery::select()
            .columns(["id", "name", "identifier", "description", "status"])
            .from("projects")
            .and_where(
                Expr::col("name")
                    .like(like.clone())
                    .or(Expr::col("description").like(like.clone()))
                    .or(Expr::col("identifier").like(like.clone())),
            )
            .limit(5)
            .to_owned();

        let projects = crate::db::fetch_all(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        results["projects"] = json!(projects.into_iter().map(|r| {
            json!({
                "id": r.get::<i64, _>("id").to_string(),
                "name": r.get::<String, _>("name"),
                "identifier": r.get::<String, _>("identifier"),
                "description": r.get::<Option<String>, _>("description"),
                "status": r.get::<String, _>("status")
            })
        }).collect::<Vec<Value>>());
    }

    if search_type == "all" || search_type == "wiki" {
        let stmt = SeaQuery::select()
            .columns([("w", "id"), ("w", "title"), ("w", "slug"), ("w", "updated_at")])
            .expr_as(Expr::col(("p", "name")), "project_name")
            .expr_as(Expr::col(("p", "identifier")), "project_identifier")
            .from_as("wiki_pages", "w")
            .join_as(
                JoinType::InnerJoin,
                "projects",
                "p",
                Expr::col(("p", "id")).equals(("w", "project_id")),
            )
            .and_where(
                Expr::col(("w", "title"))
                    .like(like.clone())
                    .or(Expr::col(("w", "content")).like(like.clone())),
            )
            .limit(5)
            .to_owned();

        let wiki = crate::db::fetch_all(&pool, &stmt)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"success": false, "error": e.to_string()}))))?;

        results["wiki"] = json!(wiki.into_iter().map(|r| {
            json!({
                "id": r.get::<i64, _>("id").to_string(),
                "title": r.get::<String, _>("title"),
                "slug": r.get::<String, _>("slug"),
                "project_name": r.get::<String, _>("project_name"),
                "project_identifier": r.get::<String, _>("project_identifier"),
                "updated_at": r.get::<String, _>("updated_at")
            })
        }).collect::<Vec<Value>>());
    }

    Ok(Json(json!({ "success": true, "data": results })))
}
