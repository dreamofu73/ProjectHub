use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::routes::auth::register,
        crate::routes::auth::login,
        crate::routes::users::get_users,
        crate::routes::users::get_user_by_id,
        crate::routes::users::create_user,
        crate::routes::users::update_user,
        crate::routes::users::bulk_update_department,
        crate::routes::users::update_user_password,
        crate::routes::users::delete_user,
        crate::routes::users::get_user_activity
    ),
    components(
        schemas(
            crate::models::User,
            crate::models::AppConfig,
            crate::models::LoginRequest,
            crate::models::RegisterRequest,
            crate::models::UpdateUserRequest,
            crate::models::UpdateProfileRequest,
            crate::models::UpdatePasswordRequest,
            crate::models::UpdateProfileImageRequest
        )
    ),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;

struct SecurityAddon;
impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearerAuth",
            utoipa::openapi::security::SecurityScheme::Http(
                utoipa::openapi::security::HttpBuilder::new()
                    .scheme(utoipa::openapi::security::HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .build(),
            ),
        );
    }
}
