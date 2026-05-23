#!/bin/sh
# Nginx를 백그라운드에서 실행
nginx -g "daemon off;" &

# 백엔드 서버 실행
./pms
