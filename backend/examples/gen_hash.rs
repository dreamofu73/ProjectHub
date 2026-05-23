use argon2::{Argon2, PasswordHasher};
use argon2::password_hash::{rand_core::OsRng, SaltString};

fn main() {
    // 실제 사용 시에는 원하는 비밀번호로 변경하세요
    let password = std::env::var("PASSWORD").unwrap_or_else(|_| "admin".to_string());
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2.hash_password(password.as_bytes(), &salt).unwrap();
    println!("{}", hash.to_string());
}
