import React, { useState, useEffect, useRef } from "react";

interface LazyImageProps {
  src?: string;
  alt: string;
  className?: string;
  placeholder?: React.ReactNode;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = "",
  placeholder,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [src]);

  return (
    <div ref={imgRef} className={className}>
      {isInView && src ? (
        <>
          {!isLoaded && placeholder && <div>{placeholder}</div>}
          <img
            src={src}
            alt={alt}
            onLoad={() => setIsLoaded(true)}
            style={{ display: isLoaded ? "block" : "none" }}
          />
        </>
      ) : (
        placeholder || <div className="image-placeholder" />
      )}
    </div>
  );
};

