type ProfileImageCrop = {
  objectPosition?: string;
  profileImagePositionX?: number | null;
  profileImagePositionY?: number | null;
  profileImageZoom?: number | null;
};

export function getProfileImageObjectPosition(crop: ProfileImageCrop) {
  if (
    crop.profileImagePositionX == null &&
    crop.profileImagePositionY == null &&
    crop.objectPosition
  ) {
    return crop.objectPosition;
  }

  return `${getProfileImagePercentValue(crop.profileImagePositionX, 50)}% ${getProfileImagePercentValue(
    crop.profileImagePositionY,
    50,
  )}%`;
}

export function getProfileImageTransform(crop: ProfileImageCrop) {
  const zoom = getProfileImageZoomValue(crop.profileImageZoom, 100);

  if (zoom <= 100) {
    return undefined;
  }

  const scale = zoom / 100;
  const maxTranslate = Math.max(0, (scale - 1) * 48);
  const translateX =
    ((50 - getProfileImagePercentValue(crop.profileImagePositionX, 50)) / 50) *
    maxTranslate;
  const translateY =
    ((50 - getProfileImagePercentValue(crop.profileImagePositionY, 50)) / 50) *
    maxTranslate;

  return `translate3d(${translateX}%, ${translateY}%, 0) scale(${scale})`;
}

export function getProfileImagePercentValue(
  value: number | null | undefined,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getProfileImageZoomValue(
  value: number | null | undefined,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(220, Math.max(100, Math.round(value)));
}
