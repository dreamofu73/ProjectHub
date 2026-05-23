use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::{Extension, Query},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use futures::{SinkExt, StreamExt};

pub async fn chat_ws(
    ws: WebSocketUpgrade,
    Query(params): Query<HashMap<String, String>>,
    Extension(sender): Extension<Arc<broadcast::Sender<String>>>,
    Extension(jwt_secret): Extension<Arc<String>>,
) -> Response {
    let token = match params.get("token") {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, "missing token").into_response(),
    };
    if crate::auth::verify_jwt(token, &jwt_secret).is_err() {
        return (StatusCode::UNAUTHORIZED, "invalid token").into_response();
    }
    ws.on_upgrade(move |socket| handle_socket(socket, sender))
}

async fn handle_socket(socket: WebSocket, sender: Arc<broadcast::Sender<String>>) {
    let mut rx = sender.subscribe();
    let (mut sender_ws, mut receiver_ws) = socket.split();

    let send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(text) => {
                    if sender_ws.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let recv_task = tokio::spawn(async move {
        loop {
            match receiver_ws.next().await {
                Some(Ok(Message::Close(_))) | None => break,
                _ => continue,
            }
        }
    });

    let _ = tokio::join!(send_task, recv_task);
}
