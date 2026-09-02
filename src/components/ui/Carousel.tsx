"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface CarouselItem {
  imageUrl: string;
  linkUrl?: string; // Optional link
}

interface CarouselProps {
  images: (string | CarouselItem)[];
  autoSlideInterval?: number;
}

export default function Carousel({ images, autoSlideInterval = 5000 }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (px)
  const minSwipeDistance = 50;

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, autoSlideInterval);
    return () => clearInterval(slideInterval);
  }, [images.length, autoSlideInterval, currentIndex]); // Added currentIndex to reset timer on interaction

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Next Slide
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }
    if (isRightSwipe) {
      // Prev Slide
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const handleBannerClick = (link?: string) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="relative w-full h-48 overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex transition-transform duration-500 ease-out h-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((item, index) => {
          const src = typeof item === 'string' ? item : item.imageUrl;
          const link = typeof item === 'string' ? undefined : item.linkUrl;

          return (
            <div
              key={index}
              className="w-full flex-shrink-0 relative h-full cursor-pointer"
              onClick={() => handleBannerClick(link)}
              role={link ? 'button' : undefined}
              tabIndex={link ? 0 : undefined}
              aria-label={link ? `Slide ${index + 1}` : undefined}
              onKeyDown={
                link
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleBannerClick(link);
                      }
                    }
                  : undefined
              }
            >
              <Image
                src={src}
                alt={`Slide ${index}`}
                fill
                className="object-cover"
                priority={index === 0}
              />
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />

      {/* 페이지 카운터 (Figma 27:857) — n / total */}
      {images.length > 1 && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute bottom-3 right-3 flex items-center justify-center rounded-[10px] border border-brand-primary-400/30 bg-[rgba(25,25,25,0.6)] px-[5px] py-0.5"
        >
          <span className="text-[12px] leading-none tracking-[-0.18px] text-white">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
      )}
    </div>
  );
}
