use std::sync::Arc;
use tokio::sync::broadcast;
use tracing_subscriber::{Registry, EnvFilter, prelude::*};
use tracing_subscriber::reload;

use axum::{
    extract::Extension,
    http::Method,
    routing::get,
    Router,
};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use backend::{db, log_level, models, openapi, routes, scheduler, ws};

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let config_file = if args.len() > 1 {
        args[1].clone()
    } else {
        "config.toml".to_string()
    };

    let app_config = models::AppConfig::load(&config_file);

    let config_path_display = std::path::Path::new(&config_file)
        .canonicalize()
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default().join(&config_file));

    const INSECURE_JWT_SECRETS: &[&str] = &[
        "your-super-secret-jwt-key-change-in-production",
        "default-secret",
    ];
    if INSECURE_JWT_SECRETS.contains(&app_config.jwt_secret.as_str()) {
        eprintln!(
            "ERROR: {}의 jwt_secret이 기본값입니다. 운영을 시작하기 전에 강한 임의 문자열(최소 32바이트)로 교체하세요.",
            config_path_display.display()
        );
        println!("프로그램을 종료하려면 Enter 키를 누르세요...");
        let mut input = String::new();
        let _ = std::io::stdin().read_line(&mut input);
        std::process::exit(1);
    }
    if app_config.admin_password.as_deref() == Some("admin_password_change_me") {
        eprintln!(
            "ERROR: {}의 admin_password가 기본값('admin_password_change_me')입니다. 운영을 시작하기 전에 변경하세요.",
            config_path_display.display()
        );
        println!("프로그램을 종료하려면 Enter 키를 누르세요...");
        let mut input = String::new();
        let _ = std::io::stdin().read_line(&mut input);
        std::process::exit(1);
    }

    // Initialize tracing
    let log_dir = std::path::Path::new("./logs");
    if !log_dir.exists() {
        let _ = std::fs::create_dir_all(log_dir);
    }
    
    let log_writer = file_rotate::FileRotate::new(
        "logs/pms.log",
        file_rotate::suffix::AppendCount::new(app_config.log_max_files),
        file_rotate::ContentLimit::Bytes((app_config.log_max_size_mb * 1024 * 1024) as usize),
        file_rotate::compression::Compression::None,
        None,
    );
    
    let (non_blocking, _guard) = tracing_appender::non_blocking(log_writer);
    
    let env_filter = EnvFilter::from_default_env()
        .add_directive(tracing::Level::INFO.into());

    let (filter_layer, reload_handle) = reload::Layer::new(env_filter);

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_writer(non_blocking);

    let subscriber = Registry::default()
        .with(filter_layer)
        .with(fmt_layer);

    tracing::subscriber::set_global_default(subscriber).unwrap();

    let log_level_control = log_level::LogLevelControl::new(reload_handle);

    let pool = db::init_pool(&app_config.database_url).await;
    db::run_migrations(&pool).await;
    db::seed_data(&pool, &app_config).await;

    // 백그라운드 스케줄러 기동 (예약 발송, 만료 알림 및 자동 삭제 처리)
    let scheduler = scheduler::start(pool.clone());

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(vec![Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers(Any);

    let (chat_tx, _) = broadcast::channel::<String>(256);

    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", openapi::ApiDoc::openapi()))
        .route("/api", get(|| async { axum::response::Redirect::temporary("/swagger-ui") }))
        .route("/api/", get(|| async { axum::response::Redirect::temporary("/swagger-ui") }))
        .nest("/api", routes::api_router())
        .route("/api/ws/chat", get(ws::chat_ws))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(Extension(Arc::new(pool)))
        .layer(Extension(Arc::new(app_config.jwt_secret.clone())))
        .layer(Extension(Arc::new(app_config.clone())))
        .layer(Extension(Arc::new(scheduler)))
        .layer(Extension(Arc::new(chat_tx)))
        .layer(Extension(Arc::new(log_level_control)));

    let addr = format!("0.0.0.0:{}", app_config.port);
    tracing::info!("Axum server running on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
