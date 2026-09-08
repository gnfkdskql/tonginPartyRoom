"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlaceholder } from "./placeholder";

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

// SDK 스크립트를 한 번만 로드하기 위한 모듈 단위 캐시
let sdkPromise: Promise<void> | null = null;

function loadKakaoSdk(appKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  // 이미 로드됨
  if ((window as unknown as { kakao?: { maps?: unknown } }).kakao?.maps) {
    return Promise.resolve();
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Kakao SDK 로드 실패"));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

type KakaoMapProps = {
  lat: number;
  lng: number;
  label?: string;
  /** 마커 클릭 시 열 카카오맵 장소 URL */
  placeUrl?: string;
  level?: number;
  className?: string;
};

// 전역 kakao 타입은 SDK가 주입하므로 any 허용
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao: any;
  }
}

export function KakaoMap({
  lat,
  lng,
  label,
  placeUrl,
  level = 4,
  className = "",
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!KAKAO_KEY) {
      setFailed(true);
      return;
    }
    let cancelled = false;

    loadKakaoSdk(KAKAO_KEY)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.kakao.maps.load(() => {
          if (cancelled || !containerRef.current) return;
          const { kakao } = window;
          const center = new kakao.maps.LatLng(lat, lng);
          const map = new kakao.maps.Map(containerRef.current, {
            center,
            level,
          });

          const marker = new kakao.maps.Marker({ position: center });
          marker.setMap(map);

          if (label) {
            const overlay = new kakao.maps.CustomOverlay({
              position: center,
              yAnchor: 2.2,
              content: `<div style="padding:6px 12px;background:#111;color:#fff;font-size:12px;font-weight:600;border-radius:9999px;white-space:nowrap;">${label}</div>`,
            });
            overlay.setMap(map);
          }

          if (placeUrl) {
            kakao.maps.event.addListener(marker, "click", () => {
              window.open(placeUrl, "_blank", "noopener");
            });
          }

          // 휠 줌은 막고(스크롤 방해 방지) 버튼/더블클릭만 허용
          map.setZoomable(false);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, label, placeUrl, level]);

  if (failed) {
    return <ImagePlaceholder label="지도" className={className} />;
  }

  return <div ref={containerRef} className={`h-full w-full ${className}`} />;
}
