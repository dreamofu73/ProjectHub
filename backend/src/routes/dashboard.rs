use axum::{
    extract::Extension,
    response::Json,
    http::StatusCode,
    routing::get,
    Router,
};
use std::sync::Arc;
use serde_json::{json, Value};
use sqlx::{AnyPool, Row};
use sea_query::{Asterisk, Expr, ExprTrait, JoinType, Order, Query as SeaQuery, Func};
use crate::auth::AuthUser;

pub fn router() -> crate::routes::ProtectedRoutes {
    crate::routes::ProtectedRoutes::from_router(
        Router::new()
            .route("/dashboard", get(get_dashboard)),
    )
}

async fn get_dashboard(
    user: AuthUser,
    Extension(pool): Extension<Arc<AnyPool>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = user.id;
    let is_admin = user.role == "admin";

    let total_projects: i64 = if is_admin {
        let stmt = SeaQuery::select()
            .expr(Func::count(Expr::cust("*")))
            .from("projects")
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    } else {
        let stmt = SeaQuery::select()
            .expr(Func::count_distinct(Expr::col(("p", "id"))))
            .from_as("projects", "p")
            .join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("p", "id")))
            .and_where(Expr::col(("pm", "user_id")).eq(user_id))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    };

    // 활성화 프로젝트 수는 목록(LIMIT 6)이 아닌 전체 개수를 별도로 계산합니다.
    let active_projects: i64 = if is_admin {
        let stmt = SeaQuery::select()
            .expr(Func::count(Expr::cust("*")))
            .from("projects")
            .and_where(Expr::col("status").eq("active"))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    } else {
        let stmt = SeaQuery::select()
            .expr(Func::count_distinct(Expr::col(("p", "id"))))
            .from_as("projects", "p")
            .join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("p", "id")))
            .and_where(Expr::col(("pm", "user_id")).eq(user_id))
            .and_where(Expr::col(("p", "status")).eq("active"))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    };

    let total_issues: i64 = if is_admin {
        let stmt = SeaQuery::select()
            .expr(Func::count(Expr::cust("*")))
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    } else {
        let stmt = SeaQuery::select()
            .expr(Func::count(Expr::cust("*")))
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("p", "id")))
            .and_where(Expr::col(("pm", "user_id")).eq(user_id))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    };

    let open_issues: i64 = if is_admin {
        let stmt = SeaQuery::select()
            .expr(Func::count(Expr::cust("*")))
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .and_where(Expr::col(("i", "status")).is_not_in(["closed", "rejected"]))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    } else {
        let stmt = SeaQuery::select()
            .expr(Func::count(Expr::cust("*")))
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("p", "id")))
            .and_where(Expr::col(("pm", "user_id")).eq(user_id))
            .and_where(Expr::col(("i", "status")).is_not_in(["closed", "rejected"]))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    };

    let my_open_issues: i64 = if is_admin {
        let stmt = SeaQuery::select()
            .expr(Func::count(Expr::cust("*")))
            .from("issues")
            .and_where(Expr::col("assigned_to_id").eq(user_id))
            .and_where(Expr::col("status").is_not_in(["closed", "rejected"]))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    } else {
        let stmt = SeaQuery::select()
            .expr(Func::count(Expr::cust("*")))
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("i", "project_id")))
            .and_where(Expr::col(("pm", "user_id")).eq(user_id))
            .and_where(Expr::col(("i", "assigned_to_id")).eq(user_id))
            .and_where(Expr::col(("i", "status")).is_not_in(["closed", "rejected"]))
            .to_owned();
        crate::db::fetch_scalar(&pool, &stmt).await.unwrap_or(0)
    };

    let issues_by_status: Vec<Value> = if is_admin {
        let stmt = SeaQuery::select()
            .column(("i", "status"))
            .expr_as(Func::count(Expr::cust("*")), "count")
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .add_group_by([Expr::col(("i", "status"))])
            .to_owned();
        crate::db::fetch_all(&pool, &stmt).await.map(|rows| {
            rows.into_iter().map(|r| {
                json!({ "status": r.get::<String, _>("status"), "count": r.get::<i64, _>("count") })
            }).collect()
        }).unwrap_or_default()
    } else {
        let stmt = SeaQuery::select()
            .column(("i", "status"))
            .expr_as(Func::count(Expr::cust("*")), "count")
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("p", "id")))
            .and_where(Expr::col(("pm", "user_id")).eq(user_id))
            .add_group_by([Expr::col(("i", "status"))])
            .to_owned();
        crate::db::fetch_all(&pool, &stmt).await.map(|rows| {
            rows.into_iter().map(|r| {
                json!({ "status": r.get::<String, _>("status"), "count": r.get::<i64, _>("count") })
            }).collect()
        }).unwrap_or_default()
    };

    let issues_by_tracker: Vec<Value> = if is_admin {
        let stmt = SeaQuery::select()
            .column(("i", "tracker"))
            .expr_as(Func::count(Expr::cust("*")), "count")
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .add_group_by([Expr::col(("i", "tracker"))])
            .to_owned();
        crate::db::fetch_all(&pool, &stmt).await.map(|rows| {
            rows.into_iter().map(|r| {
                json!({ "tracker": r.get::<String, _>("tracker"), "count": r.get::<i64, _>("count") })
            }).collect()
        }).unwrap_or_default()
    } else {
        let stmt = SeaQuery::select()
            .column(("i", "tracker"))
            .expr_as(Func::count(Expr::cust("*")), "count")
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("p", "id")))
            .and_where(Expr::col(("pm", "user_id")).eq(user_id))
            .add_group_by([Expr::col(("i", "tracker"))])
            .to_owned();
        crate::db::fetch_all(&pool, &stmt).await.map(|rows| {
            rows.into_iter().map(|r| {
                json!({ "tracker": r.get::<String, _>("tracker"), "count": r.get::<i64, _>("count") })
            }).collect()
        }).unwrap_or_default()
    };

    let recent_activities = if is_admin {
        let stmt = SeaQuery::select()
            .expr(Expr::col(("a", Asterisk)))
            .expr_as(Expr::col(("u", "login")), "user_login")
            .expr_as(Expr::col(("u", "firstname")), "firstname")
            .expr_as(Expr::col(("u", "lastname")), "lastname")
            .expr_as(Expr::col(("p", "name")), "project_name")
            .expr_as(Expr::col(("p", "identifier")), "project_identifier")
            .from_as("activity_logs", "a")
            .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("a", "user_id")))
            .join_as(JoinType::LeftJoin, "projects", "p", Expr::col(("p", "id")).equals(("a", "project_id")))
            .order_by(("a", "created_at"), Order::Desc)
            .limit(20)
            .to_owned();
        crate::db::fetch_all(&pool, &stmt).await
    } else {
        let stmt = SeaQuery::select()
            .expr(Expr::col(("a", Asterisk)))
            .expr_as(Expr::col(("u", "login")), "user_login")
            .expr_as(Expr::col(("u", "firstname")), "firstname")
            .expr_as(Expr::col(("u", "lastname")), "lastname")
            .expr_as(Expr::col(("p", "name")), "project_name")
            .expr_as(Expr::col(("p", "identifier")), "project_identifier")
            .from_as("activity_logs", "a")
            .join_as(JoinType::InnerJoin, "users", "u", Expr::col(("u", "id")).equals(("a", "user_id")))
            .join_as(JoinType::LeftJoin, "projects", "p", Expr::col(("p", "id")).equals(("a", "project_id")))
            .cond_where(
                Expr::col(("a", "project_id")).is_null()
                .or(Expr::col(("a", "project_id")).in_subquery(
                    SeaQuery::select()
                        .column("project_id")
                        .from("project_members")
                        .and_where(Expr::col("user_id").eq(user_id))
                        .to_owned()
                ))
            )
            .order_by(("a", "created_at"), Order::Desc)
            .limit(20)
            .to_owned();
        crate::db::fetch_all(&pool, &stmt).await
    }
    .map(|rows| {
        rows.into_iter().map(|r| {
            let firstname: Option<String> = r.get("firstname");
            let lastname: Option<String> = r.get("lastname");
            let login: String = r.get("user_login");
            let user_name = crate::routes::utils::display_name(firstname.as_deref(), lastname.as_deref(), &login);
            json!({
                "id": r.get::<i64, _>("id").to_string(),
                "user_login": login,
                "user_name": user_name,
                "action_type": r.get::<String, _>("action_type"),
                "subject_type": r.get::<String, _>("subject_type"),
                "subject_title": r.get::<Option<String>, _>("subject_title"),
                "project_name": r.get::<Option<String>, _>("project_name"),
                "project_identifier": r.get::<Option<String>, _>("project_identifier"),
                "created_at": r.get::<String, _>("created_at")
            })
        }).collect::<Vec<Value>>()
    })
    .unwrap_or_default();

    let my_issues = if is_admin {
        let stmt = SeaQuery::select()
            .expr(Expr::col(("i", Asterisk)))
            .expr_as(Expr::col(("p", "name")), "project_name")
            .expr_as(Expr::col(("p", "identifier")), "project_identifier")
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .and_where(Expr::col(("i", "assigned_to_id")).eq(user_id))
            .and_where(Expr::col(("i", "status")).is_not_in(["closed", "rejected"]))
            .order_by(("i", "updated_at"), Order::Desc)
            .limit(10)
            .to_owned();
        crate::db::fetch_all(&pool, &stmt).await
    } else {
        let stmt = SeaQuery::select()
            .expr(Expr::col(("i", Asterisk)))
            .expr_as(Expr::col(("p", "name")), "project_name")
            .expr_as(Expr::col(("p", "identifier")), "project_identifier")
            .from_as("issues", "i")
            .join_as(JoinType::InnerJoin, "projects", "p", Expr::col(("p", "id")).equals(("i", "project_id")))
            .join_as(JoinType::InnerJoin, "project_members", "pm", Expr::col(("pm", "project_id")).equals(("p", "id")))
            .and_where(Expr::col(("pm", "user_id")).eq(user_id))
            .and_where(Expr::col(("i", "assigned_to_id")).eq(user_id))
            .and_where(Expr::col(("i", "status")).is_not_in(["closed", "rejected"]))
            .order_by(("i", "updated_at"), Order::Desc)
            .limit(10)
            .to_owned();
        crate::db::fetch_all(&pool, &stmt).await
    }
    .map(|rows| {
        rows.into_iter().map(|r| {
            json!({
                "id": r.get::<i64, _>("id").to_string(),
                "project_id": r.get::<i64, _>("project_id").to_string(),
                "tracker": r.get::<String, _>("tracker"),
                "subject": r.get::<String, _>("subject"),
                "status": r.get::<String, _>("status"),
                "priority": r.get::<String, _>("priority"),
                "project_name": r.get::<String, _>("project_name"),
                "project_identifier": r.get::<String, _>("project_identifier"),
                "updated_at": r.get::<String, _>("updated_at")
            })
        }).collect::<Vec<Value>>()
    })
    .unwrap_or_default();

    // 미해결 이슈 수는 GROUP BY 대신 상관 서브쿼리로 구합니다.
    // `GROUP BY p.id` 로 묶으면 PostgreSQL 이 그룹에 없는 `pm.role` 을 거부하고,
    // 그 오류가 아래 `unwrap_or_default()` 에 삼켜져 목록이 조용히 비어 버립니다.
    // 전체 컬럼은 `Expr::col(("p", Asterisk))` 로 지정합니다.
    // (`("p", "*")` 는 `"p"."*"` 로 인용되어 무효한 SQL 이 됩니다.)
    let mut summary_stmt = SeaQuery::select();
    summary_stmt
        .expr(Expr::col(("p", Asterisk)))
        .expr_as(
            Expr::cust(
                "(SELECT COUNT(*) FROM issues WHERE project_id = p.id AND status NOT IN ('closed', 'rejected'))",
            ),
            "open_issues",
        )
        .from_as("projects", "p")
        .and_where(Expr::col(("p", "status")).eq("active"))
        .order_by(("p", "updated_at"), Order::Desc)
        .limit(6);

    if !is_admin {
        summary_stmt
            .expr_as(Expr::col(("pm", "role")), "my_role")
            .join_as(
                JoinType::InnerJoin,
                "project_members",
                "pm",
                Expr::col(("pm", "project_id")).equals(("p", "id")),
            )
            .and_where(Expr::col(("pm", "user_id")).eq(user_id));
    }

    let projects_summary = crate::db::fetch_all(&pool, &summary_stmt)
        .await
    .map(|rows| {
        rows.into_iter().map(|r| {
            json!({
                "id": r.get::<i64, _>("id").to_string(),
                "identifier": r.get::<String, _>("identifier"),
                "name": r.get::<String, _>("name"),
                "description": r.get::<Option<String>, _>("description"),
                "open_issues": r.get::<i64, _>("open_issues"),
                "my_role": if is_admin { "admin".to_string() } else { r.get::<Option<String>, _>("my_role").unwrap_or_default() }
            })
        }).collect::<Vec<Value>>()
    })
    .unwrap_or_default();

    Ok(Json(json!({
        "success": true,
        "data": {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "total_issues": total_issues,
            "open_issues": open_issues,
            "my_open_issues": my_open_issues,
            "issues_by_status": issues_by_status,
            "issues_by_tracker": issues_by_tracker,
            "issues_by_priority": [],
            "recent_activities": recent_activities,
            "my_issues": my_issues,
            "projects_summary": projects_summary
        }
    })))
}
