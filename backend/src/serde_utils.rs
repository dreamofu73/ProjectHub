//! Custom serde (de)serializers for flexible ID parsing and string serialization.
//!
//! Frontend (JavaScript) may send Sonyflake IDs as strings ("123456789012345678")
//! or as numbers. These deserializers accept both forms, preventing 422 errors.
//!
//! On the serialization side, Sonyflake IDs exceed JavaScript's safe-integer range
//! so all ID-type `i64` values must be serialized as JSON strings rather than numbers.

use serde::{Deserialize, Deserializer, Serializer};

// ---------------------------------------------------------------------------
// Serializers — output i64 IDs as JSON strings
// ---------------------------------------------------------------------------

/// Serialize `i64` as a JSON string.
///
/// Sonyflake IDs exceed JavaScript's safe-integer range, so the frontend
/// expects IDs as strings. Use with `#[serde(serialize_with)]`.
///
/// ```rust
/// #[serde(serialize_with = "crate::serde_utils::serialize_i64_as_string")]
/// pub id: i64,
/// ```
pub fn serialize_i64_as_string<S: Serializer>(v: &i64, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.collect_str(&v.to_string())
}

/// Serialize `Option<i64>` as a JSON string or `null`.
///
/// Use with `#[serde(serialize_with)]` on optional ID fields.
pub fn serialize_opt_i64_as_string<S: Serializer>(
    v: &Option<i64>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    match v {
        Some(id) => serializer.collect_str(&id.to_string()),
        None => serializer.serialize_none(),
    }
}

/// Deserialize `i64` from either a JSON number or a JSON string.
///
/// Accepts: `123`, `"123"`, `"123456789012345678"`
pub fn string_or_number<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    struct Visitor;

    impl<'de> serde::de::Visitor<'de> for Visitor {
        type Value = i64;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("an integer or a string representation of an integer")
        }

        fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(v)
        }

        fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
            i64::try_from(v).map_err(E::custom)
        }

        fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
            v.parse::<i64>().map_err(E::custom)
        }

        fn visit_string<E: serde::de::Error>(self, v: String) -> Result<Self::Value, E> {
            v.parse::<i64>().map_err(E::custom)
        }
    }

    deserializer.deserialize_any(Visitor)
}

/// Deserialize `Option<i64>` from null, missing, a JSON number, or a JSON string.
///
/// Accepts: `null`, absent field, `123`, `"123"`, `""` (→ None)
pub fn optional_string_or_number<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    struct Visitor;

    impl<'de> serde::de::Visitor<'de> for Visitor {
        type Value = Option<i64>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("null, an integer, or a string representation of an integer")
        }

        fn visit_bool<E: serde::de::Error>(self, v: bool) -> Result<Self::Value, E> {
            Ok(Some(if v { 1 } else { 0 }))
        }

        fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v))
        }

        fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
            i64::try_from(v).map(Some).map_err(E::custom)
        }

        fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
            if v.is_empty() {
                Ok(None)
            } else {
                v.parse::<i64>().map(Some).map_err(E::custom)
            }
        }

        fn visit_string<E: serde::de::Error>(self, v: String) -> Result<Self::Value, E> {
            if v.is_empty() {
                Ok(None)
            } else {
                v.parse::<i64>().map(Some).map_err(E::custom)
            }
        }

        fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
    }

    deserializer.deserialize_any(Visitor)
}

/// Deserialize `Option<Option<i64>>` (double-nullable).
///
/// - `null` or absent → `None` (field not provided)
/// - explicit null → `Some(None)` (field provided, set to null)
/// - `123` or `"123"` → `Some(Some(id))`
///
/// This is used for fields like `assigned_to_id` where:
/// - omission = "don't change" → None
/// - explicit null = "clear the value" → Some(None)
/// - a value = "set to this id" → Some(Some(id))
pub fn nullable_string_or_number<'de, D>(deserializer: D) -> Result<Option<Option<i64>>, D::Error>
where
    D: Deserializer<'de>,
{
    struct Visitor;

    impl<'de> serde::de::Visitor<'de> for Visitor {
        type Value = Option<Option<i64>>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("null, an integer, or a string representation of an integer")
        }

        fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(Some(v)))
        }

        fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
            i64::try_from(v).map(Some).map(Some).map_err(E::custom)
        }

        fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
            if v.is_empty() {
                Ok(Some(None))
            } else {
                v.parse::<i64>()
                    .map(|id| Some(Some(id)))
                    .map_err(E::custom)
            }
        }

        fn visit_string<E: serde::de::Error>(self, v: String) -> Result<Self::Value, E> {
            if v.is_empty() {
                Ok(Some(None))
            } else {
                v.parse::<i64>()
                    .map(|id| Some(Some(id)))
                    .map_err(E::custom)
            }
        }

        fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
    }

    deserializer.deserialize_any(Visitor)
}

/// Deserialize `Vec<i64>` from a JSON array of numbers or strings.
///
/// Accepts: `[1, "2", 3]`, `["100", "200"]`, `[]`
pub fn vec_string_or_number<'de, D>(deserializer: D) -> Result<Vec<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    let items: Vec<serde_json::Value> = Vec::deserialize(deserializer)?;
    items
        .into_iter()
        .map(|v| match v {
            serde_json::Value::Number(n) => n.as_i64().ok_or_else(|| {
                serde::de::Error::custom(format!("number {n} is not a valid i64"))
            }),
            serde_json::Value::String(s) => s
                .parse::<i64>()
                .map_err(|e| serde::de::Error::custom(format!("{e}: '{s}'"))),
            other => Err(serde::de::Error::custom(format!(
                "expected number or string, got {other}"
            ))),
        })
        .collect()
}

/// Deserialize `Option<Vec<i64>>` from null or a JSON array.
pub fn opt_vec_string_or_number<'de, D>(deserializer: D) -> Result<Option<Vec<i64>>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    struct Wrapper(
        #[serde(deserialize_with = "vec_string_or_number")] Vec<i64>,
    );

    let opt: Option<Wrapper> = Option::deserialize(deserializer)?;
    Ok(opt.map(|w| w.0))
}

// ---------------------------------------------------------------------------
// serde_json::Value helpers
// ---------------------------------------------------------------------------

/// Extract an optional `i64` ID from a `serde_json::Value` field that may be a
/// JSON number or a JSON string.
///
/// Sonyflake IDs exceed JavaScript's safe-integer range, so the frontend sends
/// them as strings. Reading such a field with `Value::as_i64()` alone silently
/// yields `None`, dropping the ID. Use this helper when parsing IDs out of a raw
/// `serde_json::Value` body.
///
/// Returns `None` for JSON null, an empty string, or an unparseable value.
pub fn value_to_opt_i64(v: &serde_json::Value) -> Option<i64> {
    if let Some(n) = v.as_i64() {
        Some(n)
    } else if let Some(s) = v.as_str() {
        if s.is_empty() {
            None
        } else {
            s.parse::<i64>().ok()
        }
    } else {
        None
    }
}

// ---------------------------------------------------------------------------
// Path parameter helpers
// ---------------------------------------------------------------------------

/// Error type returned by `parse_path_id` on invalid input.
pub type PathIdError = (axum::http::StatusCode, axum::Json<serde_json::Value>);

/// Parse a path segment string into `i64`, returning a 400 JSON error on failure.
///
/// ```rust
/// async fn handler(Path(id_str): Path<String>) -> Result<..., PathIdError> {
///     let id = crate::serde_utils::parse_path_id(&id_str)?;
///     // ...
/// }
/// ```
pub fn parse_path_id(s: &str) -> Result<i64, PathIdError> {
    s.parse::<i64>().map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "success": false,
                "error": format!("Invalid ID: '{s}' ({e})")
            })),
        )
    })
}

/// Parse a path segment string into `Option<i64>`.
/// Empty or `"0"` → `None`; otherwise parses as `i64`.
pub fn parse_opt_path_id(s: &str) -> Result<Option<i64>, PathIdError> {
    if s.is_empty() || s == "0" {
        Ok(None)
    } else {
        s.parse::<i64>().map(Some).map_err(|e| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({
                    "success": false,
                    "error": format!("Invalid ID: '{s}' ({e})")
                })),
            )
        })
    }
}
