//! 기본키 생성기 (Sonyflake).
//!
//! Sonyflake 는 63비트 정수 ID 를 생성하므로 부호 있는 `i64`(BIGINT) 컬럼에 그대로
//! 담깁니다. DB 자동증가 대신 애플리케이션에서 ID 를 생성하며, 상위 비트가 시간이라
//! 대략 시간순으로 증가합니다.
//!
//! `machine_id` 는 **실제 송신 인터페이스**의 IPv4 하위 16비트(마지막 두 옥텟)로
//! 도출합니다. 송신 인터페이스는 라우팅에 따라 결정되므로, 외부 주소로 UDP `connect`
//! 했을 때 OS 가 고른 로컬 주소(`local_addr`)를 사용합니다. 실제 패킷 전송은 없습니다.
//! (`pnet` 은 Windows 에서 `Packet.lib`(Npcap SDK) 링크를 요구해 채택하지 않고,
//! 순수 표준 라이브러리로 동일한 결과를 얻습니다.)
//!
//! IP 를 얻지 못하는 환경에서는 machine_id `1` 로 폴백합니다.
//! **같은 서브넷의 서로 다른 호스트는 IP 하위 16비트가 겹치지 않아야 ID 충돌이 없습니다.**

use std::error::Error;
use std::net::{IpAddr, UdpSocket};
use std::sync::OnceLock;

use sonyflake::{Builder, Sonyflake};

static GENERATOR: OnceLock<Sonyflake> = OnceLock::new();

/// 실제 송신 인터페이스의 IPv4 하위 16비트를 machine_id 로 도출합니다.
///
/// 외부 주소로 UDP 소켓을 `connect` 하면 OS 가 라우팅 테이블을 참조해 송신 인터페이스를
/// 선택하며, `local_addr` 로 그 인터페이스의 로컬 주소를 읽습니다. 실제 전송은 없습니다.
fn machine_id_from_ip() -> Result<u16, Box<dyn Error + Send + Sync + 'static>> {
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.connect("8.8.8.8:80")?;
    match socket.local_addr()?.ip() {
        IpAddr::V4(v4) => {
            let octets = v4.octets();
            Ok(((octets[2] as u16) << 8) | (octets[3] as u16))
        }
        IpAddr::V6(_) => Err("IPv6 송신 주소에서는 machine_id 를 도출할 수 없습니다".into()),
    }
}

fn generator() -> &'static Sonyflake {
    GENERATOR.get_or_init(|| {
        Builder::new()
            .machine_id(&machine_id_from_ip)
            .finalize()
            // IP 도출/초기화 실패 시 machine_id 1 로 폴백합니다.
            .or_else(|_| Builder::new().machine_id(&|| Ok(1u16)).finalize())
            .expect("Sonyflake 생성기 초기화 실패")
    })
}

/// 새 기본키를 생성합니다. Sonyflake 63비트 값을 `i64` 로 반환합니다.
///
/// `Sonyflake` 는 내부적으로 공유 상태를 `Arc<Mutex>` 로 보관하므로 clone 이 저렴하고
/// 시퀀스 상태를 공유합니다. 따라서 전역 인스턴스를 clone 해 사용해도 안전합니다.
pub fn new_id() -> i64 {
    let sf = generator().clone();
    let id = sf.next_id().expect("Sonyflake ID 생성 실패");
    *id as i64
}
