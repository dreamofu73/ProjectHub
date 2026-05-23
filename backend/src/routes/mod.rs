pub mod auth;
pub mod users;
pub mod projects;
pub mod issues;
pub mod milestones;
pub mod wiki;
pub mod posts;
pub mod chat;
pub mod search;
pub mod dashboard;
pub mod attachments;
pub mod memos;
pub mod utils;
pub mod user_groups;
pub mod groups;
pub mod admin_groups;
pub mod admin_organization;
pub mod admin_scheduler;
pub mod admin_logs;
pub mod address_book;
pub mod notifications;
pub mod tasks;
pub mod post_comments;
pub mod issue_comments;
pub mod issue_custom_fields;

use axum::{middleware::from_extractor, Router};

use crate::auth::AuthUser;

/// 인증이 필요 없는(공개) 라우트의 newtype.
/// `auth::router()` 같은 공개 라우트만 이 타입을 반환한다.
pub struct PublicRoutes(Router);

impl PublicRoutes {
    pub fn from_router(r: Router) -> Self { Self(r) }
    pub fn merge(mut self, other: Self) -> Self {
        self.0 = self.0.merge(other.0);
        self
    }
    pub fn into_router(self) -> Router { self.0 }
}

/// JWT 인증 미들웨어 뒤에 마운트되어야 하는 라우트의 newtype.
/// 보호 라우트 모듈은 반드시 이 타입을 반환해야 한다.
/// 새 모듈을 만들고 mod.rs의 protected 영역에 등록할 때 타입이 어긋나면
/// 컴파일 에러가 발생하므로 "AuthUser 깜빡함" 회귀를 사전 차단한다.
pub struct ProtectedRoutes(Router);

impl ProtectedRoutes {
    pub fn from_router(r: Router) -> Self { Self(r) }
    pub fn merge(mut self, other: Self) -> Self {
        self.0 = self.0.merge(other.0);
        self
    }
    /// 인증 미들웨어를 적용해 최종 Router를 추출. 통과 후에는 더 이상
    /// ProtectedRoutes 타입에 묶이지 않으므로 PublicRoutes와 자유롭게 합칠 수 있다.
    pub fn into_router_with_auth(self) -> Router {
        self.0.layer(from_extractor::<AuthUser>())
    }
}

pub fn api_router() -> Router {
    let public = PublicRoutes::from_router(Router::new())
        .merge(auth::router());

    let protected = ProtectedRoutes::from_router(Router::new())
        .merge(dashboard::router())
        .merge(projects::router())
        .merge(issues::router())
        .merge(milestones::router())
        .merge(wiki::router())
        .merge(users::router())
        .merge(posts::router())
        .merge(chat::router())
        .merge(search::router())
        .merge(attachments::router())
        .merge(memos::router())
        .merge(user_groups::router())
        .merge(groups::router())
        .merge(admin_groups::router())
        .merge(admin_organization::router())
        .merge(admin_scheduler::router())
        .merge(admin_logs::router())
        .merge(address_book::router())
        .merge(notifications::router())
        .merge(tasks::router())
        .merge(post_comments::router())
        .merge(issue_comments::router())
        .merge(issue_custom_fields::router());

    public.into_router().merge(protected.into_router_with_auth())
}
