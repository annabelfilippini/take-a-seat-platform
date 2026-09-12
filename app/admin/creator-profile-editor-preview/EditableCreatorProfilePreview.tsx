"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { CREATOR_PROFILE_EDITOR_URL } from "../../_lib/creator-destination";

type EditableGalleryItem = {
  fileName?: string;
  id: string;
  kind: "photo" | "video";
  source: string;
  sourceKind?: "upload" | "url";
  title: string;
};

type EditableCreatorTab = "profile" | "availability" | "payments" | "settings";
type EditableDurationValue = number | string;
type EditablePriceValue = number | string;
type ProfileImagePointer = {
  x: number;
  y: number;
};

type EditableProfileState = {
  about: string;
  bio: string;
  calendarConnectedAt?: string | null;
  category: string;
  currency: string;
  email?: string | null;
  helpItems: string;
  id: string;
  image: string;
  instagramHandle: string;
  instagramUrl: string;
  location: string;
  mediaItems: EditableGalleryItem[];
  name: string;
  oneToOneReason: string;
  offer: string;
  phone: string;
  profileImagePositionX?: number;
  profileImagePositionY?: number;
  profileImageZoom?: number;
  profileDetails?: string | null;
  profileIntro: string;
  seat15Description: string;
  seat15DurationMinutes: EditableDurationValue;
  seat15Enabled: boolean;
  seat15PriceAmount: EditablePriceValue;
  seat30Description: string;
  seat30DurationMinutes: EditableDurationValue;
  seat30Enabled: boolean;
  seat30PriceAmount: EditablePriceValue;
  stripeConnectedAt?: string | null;
  tiktokHandle: string;
  tiktokUrl: string;
  timezone: string;
};

export type EditableNotificationPreferences = {
  bookingEmailEnabled: boolean;
  bookingProfileEnabled: boolean;
  bookingSmsEnabled: boolean;
};

export type EditableCreatorNotification = {
  body: string;
  bookingId: string;
  createdAt: string;
  id: string;
  readAt?: string | null;
  title: string;
  type: string;
};

type EditableAvailabilityRule = {
  bufferMinutes?: number | null;
  dayOfWeek: number;
  enabled?: boolean;
  endTime: string;
  maxBookingsPerDay?: number | null;
  maxBookingsPerWeek?: number | null;
  minNoticeMinutes?: number | null;
  startTime: string;
  timezone: string;
};

const creatorTabs: Array<{ id: EditableCreatorTab; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "availability", label: "Availability" },
  { id: "payments", label: "Payments" },
  { id: "settings", label: "Settings" },
];

const homepageCategories = [
  "Style & Beauty",
  "Fitness & Wellness",
  "Food",
  "Home Interiors",
];

const defaultNotificationPreferences: EditableNotificationPreferences = {
  bookingEmailEnabled: true,
  bookingProfileEnabled: true,
  bookingSmsEnabled: true,
};

const availabilityDays = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

type AvailabilityTimeSlot = {
  isHour: boolean;
  label: string;
  value: string;
};

type AvailabilityMonthOption = {
  label: string;
  month: number;
  value: string;
  year: number;
};

type AvailabilityWeekDay = {
  dateLabel: string;
  label: string;
  value: number;
};

const availabilityTimeSlots = createAvailabilityTimeSlots(8, 21);
const timezoneOptions = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

const tiktokPlayerOptions = [
  "autoplay=1",
  "muted=1",
  "loop=1",
  "controls=0",
  "play_button=0",
  "volume_control=0",
  "fullscreen_button=0",
  "progress_bar=0",
  "timestamp=0",
  "music_info=0",
  "description=0",
  "rel=0",
  "native_context_menu=0",
  "closed_caption=0",
].join("&");

export function EditableCreatorProfilePreview({
  initialAvailabilityRules = [],
  initialProfile,
  initialNotificationPreferences = defaultNotificationPreferences,
  initialNotifications = [],
}: {
  initialAvailabilityRules?: EditableAvailabilityRule[];
  initialProfile: EditableProfileState;
  initialNotificationPreferences?: EditableNotificationPreferences;
  initialNotifications?: EditableCreatorNotification[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [activeCreatorTab, setActiveCreatorTab] =
    useState<EditableCreatorTab>("profile");
  const [draftMedia, setDraftMedia] = useState<{
    fileName: string;
    kind: EditableGalleryItem["kind"];
    title: string;
    uploadedSource: string;
  }>({
    fileName: "",
    kind: "photo",
    title: "",
    uploadedSource: "",
  });
  const draftMediaFileInputRef = useRef<HTMLInputElement>(null);
  const profileImageDragRef = useRef<{
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const profileImageFrameRef = useRef<HTMLSpanElement>(null);
  const profileImageGestureRef = useRef<{
    scale: number;
    zoom: number;
  } | null>(null);
  const profileImagePinchRef = useRef<{
    distance: number;
    zoom: number;
  } | null>(null);
  const profileImagePointersRef = useRef<Map<number, ProfileImagePointer>>(
    new Map(),
  );
  const [profileImageFileName, setProfileImageFileName] = useState("");
  const profileImagePositionX = getPercentValue(profile.profileImagePositionX);
  const profileImagePositionY = getPercentValue(profile.profileImagePositionY);
  const profileImageZoom = getZoomValue(profile.profileImageZoom);
  const profileImageScale = profileImageZoom / 100;
  const profileImageMaxTranslate = Math.max(0, (profileImageScale - 1) * 48);
  const profileImageTranslateX =
    ((50 - profileImagePositionX) / 50) * profileImageMaxTranslate;
  const profileImageTranslateY =
    ((50 - profileImagePositionY) / 50) * profileImageMaxTranslate;
  const profileImageTransform = `translate3d(${profileImageTranslateX}%, ${profileImageTranslateY}%, 0) scale(${profileImageScale})`;
  const [mediaSaveStatus, setMediaSaveStatus] = useState<
    "error" | "idle" | "saved" | "saving"
  >("saved");

  useEffect(() => {
    const frame = profileImageFrameRef.current;

    if (!frame || !profile.image) {
      return;
    }

    function startGestureZoom(event: Event) {
      event.preventDefault();
      profileImageGestureRef.current = {
        scale: getGestureScale(event),
        zoom: profileImageZoom,
      };
    }

    function changeGestureZoom(event: Event) {
      event.preventDefault();

      if (!profileImageGestureRef.current) {
        return;
      }

      const startScale = Math.max(profileImageGestureRef.current.scale, 0.01);
      const nextScale = getGestureScale(event) / startScale;

      updateProfileImageZoom(profileImageGestureRef.current.zoom * nextScale);
    }

    function stopGestureZoom() {
      profileImageGestureRef.current = null;
    }

    frame.addEventListener("gesturestart", startGestureZoom, { passive: false });
    frame.addEventListener("gesturechange", changeGestureZoom, { passive: false });
    frame.addEventListener("gestureend", stopGestureZoom);

    return () => {
      frame.removeEventListener("gesturestart", startGestureZoom);
      frame.removeEventListener("gesturechange", changeGestureZoom);
      frame.removeEventListener("gestureend", stopGestureZoom);
    };
  }, [profile.image, profileImageZoom]);

  const helpItems = useMemo(
    () =>
      profile.helpItems
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [profile.helpItems],
  );

  function update<K extends keyof EditableProfileState>(
    key: K,
    value: EditableProfileState[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateSocialUrl(
    key: "instagramUrl" | "tiktokUrl",
    value: string,
  ) {
    setProfile((current) => ({
      ...current,
      [key]: value,
      ...(key === "instagramUrl"
        ? { instagramHandle: getSocialHandleFromUrl(value) || current.instagramHandle }
        : { tiktokHandle: getSocialHandleFromUrl(value) || current.tiktokHandle }),
    }));
  }

  function chooseMediaItemFile(id: string, file: File | undefined) {
    if (!file || !isSupportedMediaFile(file)) {
      return;
    }

    readFileAsDataUrl(file, (source) => {
      setMediaSaveStatus("idle");
      setProfile((current) => ({
        ...current,
        mediaItems: current.mediaItems.map((item) =>
          item.id === id
            ? {
                ...item,
                fileName: file.name,
                kind: getMediaKindForFile(file),
                source,
                sourceKind: "upload",
                title: item.title || getMediaTitleFromFileName(file.name),
              }
            : item,
        ),
      }));
    });
  }

  function removeMediaItem(id: string) {
    setMediaSaveStatus("idle");
    setProfile((current) => ({
      ...current,
      mediaItems: current.mediaItems.filter((item) => item.id !== id),
    }));
  }

  function addMediaItem() {
    const source = draftMedia.uploadedSource;

    if (!source) {
      return;
    }

    setProfile((current) => ({
      ...current,
      mediaItems: [
        ...current.mediaItems,
        {
          fileName: draftMedia.fileName || undefined,
          id: globalThis.crypto?.randomUUID?.() ?? `media-${Date.now()}`,
          kind: draftMedia.kind,
          source,
          sourceKind: "upload",
          title:
            draftMedia.title.trim() ||
            `${draftMedia.kind === "photo" ? "Photo" : "Video"} ${
              current.mediaItems.length + 1
            }`,
        },
      ],
    }));
    setMediaSaveStatus("idle");
    setDraftMedia((current) => ({
      ...current,
      fileName: "",
      title: "",
      uploadedSource: "",
    }));
    if (draftMediaFileInputRef.current) {
      draftMediaFileInputRef.current.value = "";
    }
  }

  function chooseProfileImage(file: File | undefined) {
    if (!file) {
      return;
    }

    readFileAsDataUrl(file, (source) => {
      setProfile((current) => ({
        ...current,
        image: source,
        profileImagePositionX: 50,
        profileImagePositionY: 50,
        profileImageZoom: 135,
      }));
      setMediaSaveStatus("idle");
      setProfileImageFileName(file.name);
    });
  }

  function updateProfileImagePosition(next: {
    x?: number | string;
    y?: number | string;
  }) {
    setProfile((current) => ({
      ...current,
      profileImagePositionX: getPercentValue(
        next.x ?? current.profileImagePositionX,
      ),
      profileImagePositionY: getPercentValue(
        next.y ?? current.profileImagePositionY,
      ),
    }));
  }

  function updateProfileImageZoom(value: number) {
    setProfile((current) => ({
      ...current,
      profileImageZoom: getZoomValue(value),
    }));
  }

  function adjustProfileImageZoom(delta: number) {
    setProfile((current) => ({
      ...current,
      profileImageZoom: getZoomValue(getZoomValue(current.profileImageZoom) + delta),
    }));
  }

  function panProfileImage(deltaX: number, deltaY: number) {
    setProfile((current) => ({
      ...current,
      profileImagePositionX: getPercentValue(
        getPercentValue(current.profileImagePositionX) + deltaX * 0.18,
      ),
      profileImagePositionY: getPercentValue(
        getPercentValue(current.profileImagePositionY) + deltaY * 0.18,
      ),
    }));
  }

  function startProfileImageDrag(event: PointerEvent<HTMLSpanElement>) {
    if (!profile.image) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    profileImagePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (profileImagePointersRef.current.size >= 2) {
      profileImageDragRef.current = null;
      profileImagePinchRef.current = {
        distance: getProfileImagePointerDistance(profileImagePointersRef.current),
        zoom: profileImageZoom,
      };
      return;
    }

    profileImagePinchRef.current = null;
    profileImageDragRef.current = {
      originX: profileImagePositionX,
      originY: profileImagePositionY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function dragProfileImage(event: PointerEvent<HTMLSpanElement>) {
    if (profileImagePointersRef.current.has(event.pointerId)) {
      profileImagePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (profileImagePinchRef.current && profileImagePointersRef.current.size >= 2) {
      event.preventDefault();
      const nextDistance = getProfileImagePointerDistance(
        profileImagePointersRef.current,
      );
      const zoomDelta = (nextDistance - profileImagePinchRef.current.distance) * 0.55;

      updateProfileImageZoom(profileImagePinchRef.current.zoom + zoomDelta);
      return;
    }

    const drag = profileImageDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const frameSize = Math.max(
      event.currentTarget.getBoundingClientRect().width,
      1,
    );
    const deltaX = ((event.clientX - drag.startX) / frameSize) * 100;
    const deltaY = ((event.clientY - drag.startY) / frameSize) * 100;

    updateProfileImagePosition({
      x: drag.originX - deltaX,
      y: drag.originY - deltaY,
    });
  }

  function stopProfileImageDrag(event: PointerEvent<HTMLSpanElement>) {
    profileImagePointersRef.current.delete(event.pointerId);
    profileImagePinchRef.current = null;

    if (
      profileImageDragRef.current?.pointerId === event.pointerId &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    profileImageDragRef.current = null;
  }

  function wheelZoomProfileImage(event: WheelEvent<HTMLSpanElement>) {
    if (!profile.image) {
      return;
    }

    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      const zoomDelta = Math.max(-14, Math.min(14, -event.deltaY * 0.08));
      adjustProfileImageZoom(zoomDelta);
      return;
    }

    panProfileImage(event.deltaX, event.deltaY);
  }

  function chooseDraftMediaFile(file: File | undefined) {
    if (!file || !isSupportedMediaFile(file)) {
      return;
    }

    readFileAsDataUrl(file, (source) => {
      setDraftMedia((current) => ({
        ...current,
        fileName: file.name,
        kind: getMediaKindForFile(file),
        title: current.title || getMediaTitleFromFileName(file.name),
        uploadedSource: source,
      }));
    });
  }

  async function saveMediaItems() {
    setMediaSaveStatus("saving");

    try {
      const response = await fetch("/api/creators/profile", {
        body: getProfileSettingsFormData(profile),
        headers: { accept: "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Profile media save failed.");
      }

      setMediaSaveStatus("saved");
    } catch {
      setMediaSaveStatus("error");
    }
  }

  return (
    <main className="platform-shell amber-profile-page editable-profile-page">
      <div className="profile-announcement">Editable creator profile preview</div>
      <header className="topbar profile-topbar">
        <a className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <nav className="profile-nav" aria-label="Editable profile preview tabs">
          {creatorTabs.map((tab) => (
            <button
              aria-label={tab.id === "settings" ? tab.label : undefined}
              aria-controls={`editable-creator-${tab.id}`}
              aria-selected={activeCreatorTab === tab.id}
              className={`profile-nav-tab${tab.id === "settings" ? " settings-tab-button" : ""}`}
              id={`editable-creator-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveCreatorTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.id === "settings" ? <SettingsTabIcon /> : tab.label}
            </button>
          ))}
        </nav>
      </header>

      <div
        aria-labelledby="editable-creator-tab-profile"
        hidden={activeCreatorTab !== "profile"}
        id="editable-creator-profile"
        role="tabpanel"
      >
      <section className="amber-profile-hero editable-public-preview" id="public-preview">
        <div className="amber-hero-copy">
          <div className="editable-profile-photo-editor">
            <span
              aria-label="Drag profile picture to reposition it"
              className={`editable-profile-photo-frame${profile.image ? " is-draggable" : ""}`}
              onPointerCancel={stopProfileImageDrag}
              onPointerDown={startProfileImageDrag}
              onPointerMove={dragProfileImage}
              onPointerUp={stopProfileImageDrag}
              onWheel={wheelZoomProfileImage}
              ref={profileImageFrameRef}
            >
              {profile.image ? (
                <img
                  alt={`${profile.name} profile`}
                  draggable={false}
                  src={profile.image}
                  style={{ transform: profileImageTransform }}
                />
              ) : (
                <b>{profile.name.slice(0, 2) || "TS"}</b>
              )}
            </span>
            <div className="editable-profile-photo-controls">
              <label>
                <span>Upload profile picture</span>
                <input
                  accept="image/*"
                  aria-label="Upload profile picture"
                  className="editable-profile-field editable-file-input"
                  type="file"
                  onChange={(event) => chooseProfileImage(event.target.files?.[0])}
                />
              </label>
              {profileImageFileName ? (
                <p className="editable-upload-note">Uploaded {profileImageFileName}</p>
              ) : null}
              <div
                aria-label="Profile picture zoom controls"
                className="editable-profile-zoom-controls"
              >
                <button
                  aria-label="Zoom profile picture out"
                  disabled={!profile.image || profileImageZoom <= 100}
                  type="button"
                  onClick={() => updateProfileImageZoom(profileImageZoom - 10)}
                >
                  <span aria-hidden="true">-</span>
                </button>
                <output aria-live="polite">{profileImageZoom}%</output>
                <button
                  aria-label="Zoom profile picture in"
                  disabled={!profile.image || profileImageZoom >= 220}
                  type="button"
                  onClick={() => updateProfileImageZoom(profileImageZoom + 10)}
                >
                  <span aria-hidden="true">+</span>
                </button>
              </div>
            </div>
          </div>
          <EditableInput
            ariaLabel="Creator hero name"
            className="editable-profile-title"
            value={profile.name}
            onChange={(value) => update("name", value)}
          />
          <div className="editable-social-url-fields">
            <label>
              <span>Instagram URL</span>
              <input
                aria-label="Instagram URL"
                className="editable-profile-field editable-basic-input"
                placeholder="https://www.instagram.com/username"
                value={profile.instagramUrl}
                onChange={(event) =>
                  updateSocialUrl("instagramUrl", event.target.value)
                }
              />
            </label>
            <label>
              <span>TikTok URL</span>
              <input
                aria-label="TikTok URL"
                className="editable-profile-field editable-basic-input"
                placeholder="https://www.tiktok.com/@username"
                value={profile.tiktokUrl}
                onChange={(event) =>
                  updateSocialUrl("tiktokUrl", event.target.value)
                }
              />
            </label>
          </div>
          <p className="amber-meta">
            <SocialProfileLink
              href={profile.instagramUrl}
              icon="instagram"
              label={`Open ${profile.name} on Instagram`}
            />
            <SocialProfileLink
              href={profile.tiktokUrl}
              icon="tiktok"
              label={`Open ${profile.name} on TikTok`}
            />
            <EditableInput
              ariaLabel="Location"
              className="editable-inline-text"
              value={profile.location}
              onChange={(value) => update("location", value)}
            />
          </p>
          <EditableTextarea
            ariaLabel="Public profile intro"
            className="editable-profile-paragraph"
            rows={4}
            value={profile.profileIntro}
            onChange={(value) => update("profileIntro", value)}
          />
        </div>

        <EditableMediaGallery items={profile.mediaItems} name={profile.name} />
      </section>

      <section className="editable-profile-workspace editable-image-workspace" id="media">
        <div className="editable-editor-panel editable-media-panel">
          <div className="creator-form-header editable-media-header">
            <div className="editable-section-heading">
              <span>Images</span>
              <h2>Photos and videos</h2>
            </div>
            <div className="editable-save-status-group">
              <span
                className={
                  mediaSaveStatus === "saved"
                    ? "dashboard-status-complete"
                    : "dashboard-status"
                }
              >
                {mediaSaveStatus === "saving"
                  ? "Saving"
                  : mediaSaveStatus === "saved"
                    ? "Saved"
                    : mediaSaveStatus === "error"
                      ? "Save failed"
                      : "Unsaved"}
              </span>
              <button
                className="editable-primary-button editable-save-button"
                disabled={mediaSaveStatus === "saving"}
                onClick={saveMediaItems}
                type="button"
              >
                {mediaSaveStatus === "saving" ? "Saving media" : "Save media"}
              </button>
            </div>
          </div>
          <div className="editable-social-accounts">
            <label>
              <span>Homepage category</span>
              <select
                aria-label="Homepage category"
                className="editable-profile-field editable-basic-input"
                value={profile.category}
                onChange={(event) => update("category", event.target.value)}
              >
                {homepageCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="editable-media-list">
            {profile.mediaItems.map((item) => (
              <article className="editable-media-row" key={item.id}>
                <MediaPreview item={item} />
                <div className="editable-media-source-control">
                  <input
                    accept="image/*,video/*"
                    aria-label={`Upload replacement for ${item.title}`}
                    className="editable-profile-field editable-file-input"
                    type="file"
                    onChange={(event) =>
                      chooseMediaItemFile(item.id, event.target.files?.[0])
                    }
                  />
                  {item.sourceKind === "upload" && item.fileName ? (
                    <p className="editable-upload-note">Uploaded {item.fileName}</p>
                  ) : null}
                </div>
                <button
                  className="editable-secondary-button"
                  onClick={() => removeMediaItem(item.id)}
                  type="button"
                >
                  Remove
                </button>
              </article>
            ))}
          </div>

          <div className="editable-add-media">
            <div className="editable-add-source">
              <input
                accept="image/*,video/*"
                aria-label="Upload new media file"
                className="editable-profile-field editable-file-input"
                ref={draftMediaFileInputRef}
                type="file"
                onChange={(event) => chooseDraftMediaFile(event.target.files?.[0])}
              />
              {draftMedia.fileName ? (
                <p className="editable-upload-note">Uploaded {draftMedia.fileName}</p>
              ) : null}
            </div>
            <button
              className="editable-primary-button"
              disabled={!draftMedia.uploadedSource}
              onClick={addMediaItem}
              type="button"
            >
              Add media
            </button>
          </div>
        </div>
      </section>

      <section className="amber-about-section" id="about">
        <div className="about-main">
          <h2>About</h2>
          <EditableTextarea
            ariaLabel="About section"
            className="editable-about-copy"
            rows={6}
            value={profile.about}
            onChange={(value) => update("about", value)}
          />

          <div className="help-card">
            <h3>{profile.name.split(" ")[0] || "Creator"} can help with</h3>
            <EditableTextarea
              ariaLabel="What people can ask"
              className="editable-help-input"
              rows={6}
              value={profile.helpItems}
              onChange={(value) => update("helpItems", value)}
            />
            <ul>
              {helpItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="why-card">
            <h3>Why a 1:1 call?</h3>
            <EditableTextarea
              ariaLabel="One-to-one reason"
              className="editable-profile-paragraph"
              rows={4}
              value={profile.oneToOneReason}
              onChange={(value) => update("oneToOneReason", value)}
            />
          </div>
        </div>

        <aside className="reserve-panel" id="reserve" aria-label={`Book ${profile.name}`}>
          <h2 className="editable-reserve-heading">Choose a Time</h2>
          <p>Private video call on Google Meet.</p>
          <div className="seat-options">
            <EditableSeatOption
              description={profile.seat15Description}
              durationMinutes={profile.seat15DurationMinutes}
              enabled={profile.seat15Enabled}
              price={profile.seat15PriceAmount}
              onDescriptionChange={(value) => update("seat15Description", value)}
              onDurationChange={(value) => update("seat15DurationMinutes", value)}
              onEnabledChange={(value) => update("seat15Enabled", value)}
              onPriceChange={(value) => update("seat15PriceAmount", value)}
            />
            <EditableSeatOption
              description={profile.seat30Description}
              durationMinutes={profile.seat30DurationMinutes}
              enabled={profile.seat30Enabled}
              price={profile.seat30PriceAmount}
              onDescriptionChange={(value) => update("seat30Description", value)}
              onDurationChange={(value) => update("seat30DurationMinutes", value)}
              onEnabledChange={(value) => update("seat30Enabled", value)}
              onPriceChange={(value) => update("seat30PriceAmount", value)}
            />
          </div>
        </aside>
      </section>
      </div>

      <section
        aria-labelledby="editable-creator-tab-availability"
        className="editable-admin-tab-panel"
        hidden={activeCreatorTab !== "availability"}
        id="editable-creator-availability"
        role="tabpanel"
      >
        <EditableAvailabilityPanel
          calendarConnectedAt={profile.calendarConnectedAt}
          creatorId={profile.id}
          initialRules={initialAvailabilityRules}
          timezone={profile.timezone}
        />
      </section>

      <section
        aria-labelledby="editable-creator-tab-payments"
        className="editable-admin-tab-panel"
        hidden={activeCreatorTab !== "payments"}
        id="editable-creator-payments"
        role="tabpanel"
      >
        <EditablePaymentsPanel
          profile={profile}
          onEditProfile={() => setActiveCreatorTab("profile")}
        />
      </section>

      <section
        aria-labelledby="editable-creator-tab-settings"
        className="editable-admin-tab-panel"
        hidden={activeCreatorTab !== "settings"}
        id="editable-creator-settings"
        role="tabpanel"
      >
        <EditableSettingsPanel
          creatorId={profile.id}
          initialNotifications={initialNotifications}
          initialPreferences={initialNotificationPreferences}
        />
      </section>
    </main>
  );
}

function SettingsTabIcon() {
  return (
    <svg
      aria-hidden="true"
      className="settings-tab-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="M9.6 2.7h4.8l.8 3 2.7-1.5 3.4 3.4-1.5 2.7 3 .8v4.8l-3 .8 1.5 2.7-3.4 3.4-2.7-1.5-.8 3H9.6l-.8-3-2.7 1.5-3.4-3.4 1.5-2.7-3-.8v-4.8l3-.8-1.5-2.7 3.4-3.4 2.7 1.5.8-3Z" />
      <circle cx="12" cy="12.5" r="4" />
    </svg>
  );
}

function SocialProfileLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: "instagram" | "tiktok";
  label: string;
}) {
  const normalizedHref = normalizeSocialUrlForHref(href);

  if (!normalizedHref) {
    return null;
  }

  return (
    <a aria-label={label} className="profile-social-link" href={normalizedHref}>
      {icon === "instagram" ? <InstagramIcon /> : <TikTokIcon />}
    </a>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
      <circle cx="12" cy="12" r="4.1" />
      <path d="M17.35 6.7h.01" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14.2 3v11.25a4.25 4.25 0 1 1-4.25-4.25c.42 0 .84.06 1.22.18v3.05a1.48 1.48 0 1 0 1.02 1.42V3h2.01Z" />
      <path d="M14.2 3c.48 2.92 2.12 4.7 5.05 5.12v3.05c-1.98-.08-3.68-.72-5.05-1.9" />
    </svg>
  );
}

function EditableAvailabilityPanel({
  calendarConnectedAt,
  creatorId,
  initialRules,
  timezone: initialTimezone,
}: {
  calendarConnectedAt?: string | null;
  creatorId: string;
  initialRules: EditableAvailabilityRule[];
  timezone: string;
}) {
  const calendarConnected = Boolean(calendarConnectedAt);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [today] = useState(() => new Date());
  const [monthOptions] = useState(() => createAvailabilityMonthOptions(today, 13));
  const firstMonth = monthOptions[0];
  const firstWeek = createAvailabilityWeekOptionFromStart(getWeekStart(today));
  const earliestWeekValue = firstWeek.value;
  const [visibleMonthValue, setVisibleMonthValue] = useState(firstMonth?.value ?? "");
  const [selectedWeekValue, setSelectedWeekValue] = useState(firstWeek?.value ?? "");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const initialSlotKeys = useMemo(
    () => getAvailabilitySlotKeysFromRules(initialRules),
    [initialRules],
  );
  const [availabilityByWeek, setAvailabilityByWeek] = useState<Record<string, string[]>>(
    () => ({
      [firstWeek?.value ?? ""]:
        initialSlotKeys.length > 0 ? initialSlotKeys : getDefaultAvailabilitySlotKeys(),
    }),
  );
  const [saveStatus, setSaveStatus] = useState<"error" | "idle" | "saved" | "saving">(
    initialRules.length > 0 ? "saved" : "idle",
  );
  const paintActionRef = useRef<"clear" | "select" | null>(null);
  const paintStartRef = useRef<{ dayOfWeek: number; slotIndex: number } | null>(null);
  const paintedSlotsRef = useRef<Set<string>>(new Set());

  const visibleMonth = monthOptions.find(
    (option) => option.value === visibleMonthValue,
  );
  const visibleMonthIndex = monthOptions.findIndex(
    (option) => option.value === visibleMonthValue,
  );
  const selectedWeek = useMemo(
    () =>
      selectedWeekValue
        ? createAvailabilityWeekOptionFromStart(new Date(`${selectedWeekValue}T00:00:00`))
        : firstWeek,
    [firstWeek, selectedWeekValue],
  );
  const selectedSlots = useMemo(
    () =>
      new Set(
        availabilityByWeek[selectedWeek?.value ?? ""] ??
          (initialSlotKeys.length > 0 ? initialSlotKeys : []),
      ),
    [availabilityByWeek, initialSlotKeys, selectedWeek],
  );
  const selectedWeekDays = selectedWeek?.days ?? availabilityDays.map((day) => ({
    ...day,
    dateLabel: "",
  }));
  const selectedWeekLabel = selectedWeek
    ? formatAvailabilityWeekRange(selectedWeek.days)
    : "Select a week";

  function updateVisibleMonth(value: string) {
    setVisibleMonthValue(value);
  }

  function moveVisibleMonth(direction: -1 | 1) {
    const nextMonth = monthOptions[visibleMonthIndex + direction];

    if (nextMonth) {
      updateVisibleMonth(nextMonth.value);
    }
  }

  function selectCalendarWeek(weekValue: string) {
    setAvailabilityByWeek((current) =>
      current[weekValue]
        ? current
        : {
            ...current,
            [weekValue]: initialSlotKeys.length > 0 ? initialSlotKeys : [],
          },
    );
    setSelectedWeekValue(weekValue);
    setDatePickerOpen(false);
  }

  function paintSlot(key: string, action: "clear" | "select") {
    if (paintedSlotsRef.current.has(key)) {
      return;
    }

    paintedSlotsRef.current.add(key);

    setAvailabilityByWeek((current) => {
      const weekValue = selectedWeek?.value ?? "";
      const nextWeekSlots = new Set(current[weekValue] ?? []);

      if (action === "clear") {
        nextWeekSlots.delete(key);
      } else {
        nextWeekSlots.add(key);
      }

      return {
        ...current,
        [weekValue]: sortAvailabilitySlotKeys(Array.from(nextWeekSlots)),
      };
    });
    setSaveStatus("idle");
  }

  function toggleSlot(dayOfWeek: number, startTime: string) {
    const key = getAvailabilitySlotKey(dayOfWeek, startTime);
    const action = selectedSlots.has(key) ? "clear" : "select";

    paintedSlotsRef.current = new Set();
    paintSlot(key, action);
  }

  function paintAvailabilityRange(
    from: { dayOfWeek: number; slotIndex: number },
    to: { dayOfWeek: number; slotIndex: number },
    action: "clear" | "select",
  ) {
    const firstDay = Math.min(from.dayOfWeek, to.dayOfWeek);
    const lastDay = Math.max(from.dayOfWeek, to.dayOfWeek);
    const firstSlotIndex = Math.min(from.slotIndex, to.slotIndex);
    const lastSlotIndex = Math.max(from.slotIndex, to.slotIndex);

    for (let dayOfWeek = firstDay; dayOfWeek <= lastDay; dayOfWeek += 1) {
      for (
        let slotIndex = firstSlotIndex;
        slotIndex <= lastSlotIndex;
        slotIndex += 1
      ) {
        paintSlot(
          getAvailabilitySlotKey(dayOfWeek, availabilityTimeSlots[slotIndex].value),
          action,
        );
      }
    }
  }

  function handleAvailabilityPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }

    const key = getAvailabilitySlotKeyFromPointer(event);

    if (!key) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const action = selectedSlots.has(key) ? "clear" : "select";
    const slot = parseAvailabilitySlotKey(key);

    if (!slot) {
      return;
    }

    paintActionRef.current = action;
    paintStartRef.current = slot;
    paintedSlotsRef.current = new Set();
    paintAvailabilityRange(slot, slot, action);
  }

  function handleAvailabilityPointerMove(event: PointerEvent<HTMLDivElement>) {
    const action = paintActionRef.current;

    if (!action) {
      return;
    }

    const key = getAvailabilitySlotKeyFromPointer(event);

    if (!key) {
      return;
    }

    const startSlot = paintStartRef.current;
    const currentSlot = parseAvailabilitySlotKey(key);

    if (!startSlot || !currentSlot) {
      return;
    }

    event.preventDefault();
    paintAvailabilityRange(startSlot, currentSlot, action);
  }

  function stopAvailabilityPaint(event: PointerEvent<HTMLDivElement>) {
    const action = paintActionRef.current;
    const startSlot = paintStartRef.current;
    const key = getAvailabilitySlotKeyFromPointer(event);
    const currentSlot = key ? parseAvailabilitySlotKey(key) : null;

    if (action && startSlot && currentSlot) {
      paintAvailabilityRange(startSlot, currentSlot, action);
    }

    paintActionRef.current = null;
    paintStartRef.current = null;
    paintedSlotsRef.current = new Set();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function saveAvailability() {
    setSaveStatus("saving");

    try {
      const response = await fetch("/api/creators/availability", {
        body: getAvailabilityFormData({
          creatorId,
          initialRules,
          selectedSlots,
          timezone,
        }),
        headers: { accept: "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Availability save failed.");
      }

      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <div className="editable-editor-panel editable-wide-editor-panel">
      <div className="creator-form-header">
        <div className="editable-section-heading">
          <h2>Availability</h2>
        </div>
        <div className="editable-save-status-group">
          <span className={saveStatus === "saved" ? "dashboard-status-complete" : "dashboard-status"}>
            {saveStatus === "saving"
              ? "Saving"
              : saveStatus === "saved"
                ? "Saved"
                : saveStatus === "error"
                  ? "Needs attention"
                  : "Unsaved"}
          </span>
          <a
            className="seat-secondary-button compact-form-button"
            href={`/api/google-calendar/oauth/start?creatorId=${encodeURIComponent(
              creatorId,
            )}&returnTo=${CREATOR_PROFILE_EDITOR_URL}`}
          >
            {calendarConnected ? "Calendar connected" : "Connect calendar"}
          </a>
        </div>
      </div>

      <section className="availability-date-picker" aria-label="Select availability week">
        <button
          aria-expanded={datePickerOpen}
          className="availability-date-field"
          onClick={() => setDatePickerOpen((current) => !current)}
          type="button"
        >
          <span>Select date</span>
          <strong>{selectedWeekLabel}</strong>
          <span aria-hidden="true" className="availability-date-icon" />
        </button>
        {datePickerOpen ? (
          <div className="availability-date-panel">
            <div className="availability-calendar-nav">
              <button
                aria-label="Previous month"
                disabled={visibleMonthIndex <= 0}
                onClick={() => moveVisibleMonth(-1)}
                type="button"
              >
                ‹
              </button>
              <select
                aria-label="Visible month"
                className="editable-profile-field editable-basic-input"
                value={visibleMonthValue}
                onChange={(event) => updateVisibleMonth(event.target.value)}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <button
                aria-label="Next month"
                disabled={visibleMonthIndex >= monthOptions.length - 1}
                onClick={() => moveVisibleMonth(1)}
                type="button"
              >
                ›
              </button>
            </div>
            {visibleMonth ? (
              <AvailabilityMonthCalendar
                earliestWeekValue={earliestWeekValue}
                month={visibleMonth}
                selectedWeekValue={selectedWeek?.value ?? ""}
                selectWeek={selectCalendarWeek}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="availability-settings-row">
        <label className="availability-timezone-picker">
          <span>Timezone</span>
          <input
            className="editable-profile-field editable-basic-input"
            list="creator-timezone-options"
            placeholder="Search timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
          <datalist id="creator-timezone-options">
            {timezoneOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="creator-availability-box">
        <div className="availability-calendar">
          <div className="availability-days-row">
            <span className="availability-grid-corner">Time</span>
            {selectedWeekDays.map((day) => (
              <span className="availability-day-heading" key={day.value}>
                <strong>{day.label}</strong>
                <span>{day.dateLabel}</span>
              </span>
            ))}
          </div>
          <div
            className="availability-grid"
            onPointerCancel={stopAvailabilityPaint}
            onPointerDown={handleAvailabilityPointerDown}
            onPointerMove={handleAvailabilityPointerMove}
            onPointerUp={stopAvailabilityPaint}
          >
            {availabilityTimeSlots.map((slot, slotIndex) => (
              <EditableAvailabilityRow
                key={slot.value}
                selectedSlots={selectedSlots}
                slot={slot}
                slotIndex={slotIndex}
                toggleSlot={toggleSlot}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        className="editable-primary-button editable-save-button"
        disabled={saveStatus === "saving" || selectedSlots.size === 0}
        onClick={saveAvailability}
        type="button"
      >
        {saveStatus === "saving" ? "Saving availability" : "Save availability"}
      </button>
    </div>
  );
}

function AvailabilityMonthCalendar({
  earliestWeekValue,
  month,
  selectedWeekValue,
  selectWeek,
}: {
  earliestWeekValue: string;
  month: AvailabilityMonthOption;
  selectedWeekValue: string;
  selectWeek: (weekValue: string) => void;
}) {
  const days = createAvailabilityCalendarDays(
    month.year,
    month.month,
    selectedWeekValue,
  );

  return (
    <div className="availability-month-calendar">
      <h3>{month.label}</h3>
      <div className="availability-month-weekdays" aria-hidden="true">
        {availabilityDays.map((day) => (
          <span key={day.value}>{day.label.slice(0, 2)}</span>
        ))}
      </div>
      <div className="availability-month-grid">
        {days.map((day) => {
          const disabled = day.weekValue < earliestWeekValue;
          const classNames = [
            "availability-date-button",
            day.inVisibleMonth ? "" : "muted",
            day.isSelectedWeek ? "selected" : "",
            day.dayOfWeek === 0 ? "week-start" : "",
            day.dayOfWeek === 6 ? "week-end" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              aria-pressed={day.isSelectedWeek}
              className={classNames}
              disabled={disabled}
              key={day.dateKey}
              onClick={() => selectWeek(day.weekValue)}
              type="button"
            >
              {day.dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditableAvailabilityRow({
  selectedSlots,
  slot,
  slotIndex,
  toggleSlot,
}: {
  selectedSlots: Set<string>;
  slot: AvailabilityTimeSlot;
  slotIndex: number;
  toggleSlot: (dayOfWeek: number, startTime: string) => void;
}) {
  return (
    <>
      <span className={slot.isHour ? "availability-time-label" : "availability-time-label muted"}>
        {slot.isHour ? slot.label : ""}
      </span>
      {availabilityDays.map((day) => {
        const key = getAvailabilitySlotKey(day.value, slot.value);
        const selected = selectedSlots.has(key);
        const previousSelected =
          slotIndex > 0 &&
          selectedSlots.has(getAvailabilitySlotKey(day.value, availabilityTimeSlots[slotIndex - 1].value));
        const nextSelected =
          slotIndex < availabilityTimeSlots.length - 1 &&
          selectedSlots.has(getAvailabilitySlotKey(day.value, availabilityTimeSlots[slotIndex + 1].value));
        const classNames = [
          "availability-cell",
          slot.isHour ? "hour-start" : "",
          selected ? "is-selected" : "",
          selected && !previousSelected ? "is-block-start" : "",
          selected && !nextSelected ? "is-block-end" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            aria-label={`${day.label} ${slot.label}`}
            aria-pressed={selected}
            className={classNames}
            data-availability-key={key}
            key={day.value}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                toggleSlot(day.value, slot.value);
              }
            }}
            type="button"
          />
        );
      })}
    </>
  );
}

function EditablePaymentsPanel({
  profile,
  onEditProfile,
}: {
  profile: EditableProfileState;
  onEditProfile: () => void;
}) {
  const stripeConnected = Boolean(profile.stripeConnectedAt);
  const stripeConnectHref = `/api/stripe/connect/start?creatorId=${encodeURIComponent(
    profile.id,
  )}&returnTo=${encodeURIComponent(CREATOR_PROFILE_EDITOR_URL)}`;

  return (
    <div className="editable-editor-panel editable-wide-editor-panel">
      <div className="creator-form-header">
        <div className="editable-section-heading">
          <span>Payments</span>
          <h2>Stripe payouts</h2>
        </div>
        <span className={stripeConnected ? "dashboard-status-complete" : "dashboard-status"}>
          {stripeConnected ? "Connected" : "Not connected"}
        </span>
      </div>

      <dl className="creator-dashboard-facts creator-payment-facts">
        <div>
          <dt>{formatDurationLabel(profile.seat15DurationMinutes)} seat</dt>
          <dd>
            {profile.seat15Enabled
              ? formatMoney(profile.currency, profile.seat15PriceAmount)
              : "Hidden"}
          </dd>
        </div>
        <div>
          <dt>{formatDurationLabel(profile.seat30DurationMinutes)} seat</dt>
          <dd>
            {profile.seat30Enabled
              ? formatMoney(profile.currency, profile.seat30PriceAmount)
              : "Hidden"}
          </dd>
        </div>
        <div>
          <dt>Payout account</dt>
          <dd>{stripeConnected ? "Stripe Express" : "Needed before bookings"}</dd>
        </div>
      </dl>

      <div className="creator-connect-actions">
        <a
          className="seat-primary-button"
          href={stripeConnectHref}
        >
          {stripeConnected ? "Update Stripe" : "Connect Stripe"}
        </a>
        <button className="seat-secondary-button" onClick={onEditProfile} type="button">
          Edit prices in Profile
        </button>
      </div>
    </div>
  );
}

function EditableSettingsPanel({
  creatorId,
  initialNotifications,
  initialPreferences,
}: {
  creatorId: string;
  initialNotifications: EditableCreatorNotification[];
  initialPreferences: EditableNotificationPreferences;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saveStatus, setSaveStatus] = useState<"error" | "idle" | "saved" | "saving">(
    "idle",
  );

  function updatePreference(
    key: keyof EditableNotificationPreferences,
    value: boolean,
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaveStatus("idle");
  }

  async function savePreferences() {
    setSaveStatus("saving");

    try {
      const response = await fetch("/api/creators/notifications/preferences", {
        body: JSON.stringify({
          ...preferences,
          creatorId,
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Notification preference save failed.");
      }

      const payload = (await response.json()) as {
        notificationPreferences?: EditableNotificationPreferences;
      };

      if (payload.notificationPreferences) {
        setPreferences(payload.notificationPreferences);
      }

      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <div className="creator-settings-grid">
      <div className="editable-editor-panel">
        <div className="creator-form-header">
          <div className="editable-section-heading">
            <span>Settings</span>
            <h2>Request notifications</h2>
          </div>
          <span className={saveStatus === "saved" ? "dashboard-status-complete" : "dashboard-status"}>
            {saveStatus === "saving"
              ? "Saving"
              : saveStatus === "saved"
                ? "Saved"
                : saveStatus === "error"
                  ? "Needs retry"
                  : "Default on"}
          </span>
        </div>

        <div className="notification-preference-list">
          <NotificationPreferenceToggle
            checked={preferences.bookingEmailEnabled}
            label="Email"
            name="booking-email-notifications"
            onChange={(value) => updatePreference("bookingEmailEnabled", value)}
          />
          <NotificationPreferenceToggle
            checked={preferences.bookingSmsEnabled}
            label="Text"
            name="booking-text-notifications"
            onChange={(value) => updatePreference("bookingSmsEnabled", value)}
          />
          <NotificationPreferenceToggle
            checked={preferences.bookingProfileEnabled}
            label="Profile"
            name="booking-profile-notifications"
            onChange={(value) => updatePreference("bookingProfileEnabled", value)}
          />
        </div>

        <button
          className="editable-primary-button editable-save-button"
          disabled={saveStatus === "saving"}
          onClick={savePreferences}
          type="button"
        >
          {saveStatus === "saving" ? "Saving settings" : "Save settings"}
        </button>
      </div>

      <div className="editable-editor-panel">
        <div className="editable-section-heading">
          <span>Profile</span>
          <h2>Requests and bookings</h2>
        </div>
        {initialNotifications.length ? (
          <div className="creator-notification-list">
            {initialNotifications.map((notification) => (
              <a
                className="creator-notification-item"
                href={getNotificationHref(notification)}
                key={notification.id}
              >
                <span>{formatNotificationDate(notification.createdAt)}</span>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
              </a>
            ))}
          </div>
        ) : (
          <p className="creator-notification-empty">No requests or bookings yet.</p>
        )}
      </div>
    </div>
  );
}

function NotificationPreferenceToggle({
  checked,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  label: string;
  name: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="notification-toggle-row">
      <input
        checked={checked}
        id={name}
        name={name}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={name}>
        <strong>{label}</strong>
        <em>{checked ? "On" : "Off"}</em>
      </label>
    </div>
  );
}

function getNotificationHref(notification: EditableCreatorNotification) {
  if (notification.type === "application_accepted") {
    return CREATOR_PROFILE_EDITOR_URL;
  }

  return `/bookings/${encodeURIComponent(notification.bookingId)}`;
}

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function EditableMediaGallery({
  items,
  name,
}: {
  items: EditableGalleryItem[];
  name: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollGallery(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const frame = track.querySelector(".amber-gallery-frame");
    const frameWidth = frame?.getBoundingClientRect().width ?? track.clientWidth;

    track.scrollBy({
      behavior: "smooth",
      left: direction * (frameWidth + 2),
    });
  }

  return (
    <div className="amber-hero-gallery" aria-label={`${name} photos and videos`}>
      <button
        aria-label="Show previous media"
        className="gallery-arrow gallery-arrow-prev"
        onClick={() => scrollGallery(-1)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>
      <div className="amber-gallery-track" ref={trackRef}>
        {items.map((item) => (
          <span className="amber-gallery-frame" key={item.id}>
            {item.kind === "video" && isTikTokVideoSource(item.source) ? (
              <iframe
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                loading="lazy"
                src={getVideoEmbedSource(item.source)}
                title={item.title}
              />
            ) : item.kind === "video" ? (
              <video
                controls
                loop
                muted
                playsInline
                preload="metadata"
                src={item.source}
              />
            ) : isSocialMediaUrl(item.source) ? (
              <SocialMediaFrame source={item.source} title={item.title} />
            ) : (
              <img alt={item.title} src={item.source} />
            )}
          </span>
        ))}
      </div>
      <button
        aria-label="Show next media"
        className="gallery-arrow gallery-arrow-next"
        onClick={() => scrollGallery(1)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function MediaPreview({ item }: { item: EditableGalleryItem }) {
  return (
    <span className="editable-media-thumb">
      {item.kind === "video" && isTikTokVideoSource(item.source) ? (
        <iframe
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          src={getVideoEmbedSource(item.source)}
          title={item.title}
        />
      ) : item.kind === "video" ? (
        <video controls muted playsInline preload="metadata" src={item.source} />
      ) : isSocialMediaUrl(item.source) ? (
        <SocialMediaFrame source={item.source} title={item.title} />
      ) : item.source ? (
        <img alt="" src={item.source} />
      ) : (
        <span className="editable-media-empty">No media</span>
      )}
    </span>
  );
}

function SocialMediaFrame({
  source,
  title,
}: {
  source: string;
  title: string;
}) {
  const href = normalizeSocialUrlForHref(source);
  const network = isTikTokUrl(source) ? "TikTok" : "Instagram";

  return href ? (
    <a className="editable-social-media-frame" href={href}>
      {network === "Instagram" ? <InstagramIcon /> : <TikTokIcon />}
      <span>{network}</span>
      <strong>{title}</strong>
    </a>
  ) : (
    <span className="editable-media-empty">{title}</span>
  );
}

function EditableSeatOption({
  description,
  durationMinutes,
  enabled,
  price,
  onDescriptionChange,
  onDurationChange,
  onEnabledChange,
  onPriceChange,
}: {
  description: string;
  durationMinutes: EditableDurationValue;
  enabled: boolean;
  price: EditablePriceValue;
  onDescriptionChange: (value: string) => void;
  onDurationChange: (value: EditableDurationValue) => void;
  onEnabledChange: (value: boolean) => void;
  onPriceChange: (value: EditablePriceValue) => void;
}) {
  const label = formatDurationLabel(durationMinutes);

  return (
    <article className={`seat-option${enabled ? "" : " editable-seat-disabled"}`}>
      <label className="creator-checkbox-row editable-seat-toggle">
        <input
          checked={enabled}
          type="checkbox"
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        <span>Offer this seat option</span>
      </label>
      <div className="seat-option-heading">
        <h3>{label}</h3>
        <span>Private video call</span>
      </div>
      <dl className="seat-detail-list">
        <div>
          <dt>Time</dt>
          <dd>
            <label className="editable-duration-field">
              <input
                aria-label={`${label} duration in minutes`}
                inputMode="numeric"
                max="240"
                min="5"
                type="number"
                value={durationMinutes}
                onChange={(event) => onDurationChange(event.target.value)}
              />
              <span>minutes</span>
            </label>
          </dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>
            <label className="editable-price-field">
              <span>$</span>
              <input
                inputMode="numeric"
                min="0"
                type="number"
                value={price}
                onChange={(event) => onPriceChange(event.target.value)}
              />
            </label>
          </dd>
        </div>
      </dl>
      <EditableTextarea
        ariaLabel={`${label} description`}
        className="editable-seat-description"
        rows={3}
        value={description}
        onChange={onDescriptionChange}
      />
      <button className="seat-primary-button" disabled={!enabled} type="button">
        {enabled ? "Book this seat" : "Hidden from profile"}
      </button>
    </article>
  );
}

function formatDurationLabel(value: EditableDurationValue) {
  const parsed = Number(String(value).trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Set time";
  }

  const minutes = Math.round(parsed);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function getDefaultAvailabilitySlotKeys() {
  return [
    "2|10:00",
    "2|10:15",
    "2|10:30",
    "2|10:45",
    "2|11:00",
    "2|11:15",
    "2|11:30",
    "2|11:45",
    "4|14:00",
    "4|14:15",
    "4|14:30",
    "4|14:45",
    "4|15:00",
    "4|15:15",
    "4|15:30",
    "4|15:45",
    "4|16:00",
    "4|16:15",
    "4|16:30",
    "4|16:45",
  ];
}

function getAvailabilitySlotKeysFromRules(rules: EditableAvailabilityRule[]) {
  const slotKeys = rules.flatMap((rule) => {
    if (rule.enabled === false) {
      return [];
    }

    const startIndex = availabilityTimeSlots.findIndex(
      (slot) => slot.value === rule.startTime,
    );
    const endIndex = availabilityTimeSlots.findIndex(
      (slot) => slot.value === rule.endTime,
    );

    if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
      return [];
    }

    return availabilityTimeSlots
      .slice(startIndex, endIndex)
      .map((slot) => getAvailabilitySlotKey(rule.dayOfWeek, slot.value));
  });

  return sortAvailabilitySlotKeys(Array.from(new Set(slotKeys)));
}

function getAvailabilityFormData({
  creatorId,
  initialRules,
  selectedSlots,
  timezone,
}: {
  creatorId: string;
  initialRules: EditableAvailabilityRule[];
  selectedSlots: Set<string>;
  timezone: string;
}) {
  const formData = new FormData();
  const firstRule = initialRules.find((rule) => rule.enabled !== false);

  formData.set("creatorId", creatorId);
  formData.set("timezone", timezone);
  formData.set("returnTo", CREATOR_PROFILE_EDITOR_URL);
  formData.set(
    "availabilitySlots",
    JSON.stringify(getAvailabilitySlotPayload(selectedSlots)),
  );
  formData.set("bufferMinutes", String(firstRule?.bufferMinutes ?? 15));
  formData.set("minNoticeMinutes", String(firstRule?.minNoticeMinutes ?? 1440));

  if (firstRule?.maxBookingsPerDay) {
    formData.set("maxBookingsPerDay", String(firstRule.maxBookingsPerDay));
  }

  if (firstRule?.maxBookingsPerWeek) {
    formData.set("maxBookingsPerWeek", String(firstRule.maxBookingsPerWeek));
  }

  return formData;
}

function getAvailabilitySlotPayload(selectedSlots: Set<string>) {
  return sortAvailabilitySlotKeys(Array.from(selectedSlots))
    .map((key) => parseAvailabilitySlotKey(key))
    .filter((slot): slot is { dayOfWeek: number; slotIndex: number } => Boolean(slot))
    .map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: availabilityTimeSlots[slot.slotIndex]?.value,
    }))
    .filter((slot) => Boolean(slot.startTime));
}

function EditableInput({
  ariaLabel,
  className,
  value,
  onChange,
}: {
  ariaLabel: string;
  className: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className={`editable-profile-field ${className}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function EditableTextarea({
  ariaLabel,
  className,
  rows,
  value,
  onChange,
}: {
  ariaLabel: string;
  className: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      aria-label={ariaLabel}
      className={`editable-profile-field ${className}`}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function formatMoney(currency: string, amount: EditablePriceValue) {
  const cleanAmount = String(amount).trim();
  const parsedAmount = Number(cleanAmount);

  if (!cleanAmount || !Number.isFinite(parsedAmount)) {
    return "Set price";
  }

  const symbol = currency.toUpperCase() === "USD" ? "$" : `${currency.toUpperCase()} `;
  return `${symbol}${parsedAmount}`;
}

function createAvailabilityTimeSlots(startHour: number, endHour: number) {
  const slots: AvailabilityTimeSlot[] = [];

  for (let hour = startHour; hour < endHour; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      slots.push({ isHour: minute === 0, label: formatAvailabilityTime(value), value });
    }
  }

  return slots;
}

function createAvailabilityMonthOptions(
  startDate: Date,
  monthCount: number,
): AvailabilityMonthOption[] {
  const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1);

    return {
      label: date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      month: date.getMonth(),
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      year: date.getFullYear(),
    };
  });
}

function createAvailabilityWeekOptionFromStart(weekStart: Date) {
  const cleanWeekStart = getWeekStart(weekStart);
  const weekEnd = addDays(cleanWeekStart, 6);

  return {
    days: createAvailabilityWeekDays(cleanWeekStart),
    label: `${formatAvailabilityWeekDay(cleanWeekStart)}-${formatAvailabilityWeekDay(weekEnd)}`,
    value: formatDateKey(cleanWeekStart),
  };
}

function createAvailabilityWeekDays(weekStart: Date) {
  return availabilityDays.map((day) => {
    const date = addDays(weekStart, day.value);

    return {
      dateLabel: date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
      }),
      label: day.label,
      value: day.value,
    };
  });
}

function createAvailabilityCalendarDays(
  year: number,
  month: number,
  selectedWeekValue: string,
) {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const calendarStart = getWeekStart(firstDayOfMonth);
  const calendarEnd = addDays(getWeekStart(lastDayOfMonth), 6);
  const days: Array<{
    dateKey: string;
    dayNumber: number;
    dayOfWeek: number;
    inVisibleMonth: boolean;
    isSelectedWeek: boolean;
    weekValue: string;
  }> = [];

  for (
    let currentDate = calendarStart;
    currentDate <= calendarEnd;
    currentDate = addDays(currentDate, 1)
  ) {
    const weekValue = formatDateKey(getWeekStart(currentDate));

    days.push({
      dateKey: formatDateKey(currentDate),
      dayNumber: currentDate.getDate(),
      dayOfWeek: currentDate.getDay(),
      inVisibleMonth: currentDate.getMonth() === month,
      isSelectedWeek: weekValue === selectedWeekValue,
      weekValue,
    });
  }

  return days;
}

function getWeekStart(date: Date) {
  return addDays(date, -date.getDay());
}

function addDays(date: Date, dayCount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayCount);

  return nextDate;
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatAvailabilityWeekDay(date: Date) {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatAvailabilityWeekRange(days: AvailabilityWeekDay[]) {
  const firstDay = days[0]?.dateLabel ?? "";
  const lastDay = days[days.length - 1]?.dateLabel ?? "";

  return `${firstDay} - ${lastDay}`;
}

function formatAvailabilityTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function getAvailabilitySlotKey(dayOfWeek: number, startTime: string) {
  return `${dayOfWeek}|${startTime}`;
}

function parseAvailabilitySlotKey(key: string) {
  const [dayValue, startTime] = key.split("|");
  const dayOfWeek = Number(dayValue);
  const slotIndex = availabilityTimeSlots.findIndex((slot) => slot.value === startTime);

  if (!Number.isInteger(dayOfWeek) || slotIndex < 0) {
    return null;
  }

  return { dayOfWeek, slotIndex };
}

function sortAvailabilitySlotKeys(keys: string[]) {
  return keys.sort((first, second) => {
    const firstSlot = parseAvailabilitySlotKey(first);
    const secondSlot = parseAvailabilitySlotKey(second);

    if (!firstSlot || !secondSlot) {
      return first.localeCompare(second);
    }

    return (
      firstSlot.dayOfWeek - secondSlot.dayOfWeek ||
      firstSlot.slotIndex - secondSlot.slotIndex
    );
  });
}

function getAvailabilitySlotKeyFromPointer(event: PointerEvent<HTMLElement>) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const cell = target?.closest("[data-availability-key]");

  return cell instanceof HTMLElement ? cell.dataset.availabilityKey ?? null : null;
}

function readFileAsDataUrl(file: File, onLoad: (source: string) => void) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result === "string") {
      onLoad(reader.result);
    }
  });
  reader.readAsDataURL(file);
}

function isSupportedMediaFile(file: File) {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

function getMediaKindForFile(file: File): EditableGalleryItem["kind"] {
  return file.type.startsWith("video/") ? "video" : "photo";
}

function getMediaTitleFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function getProfileSettingsFormData(profile: EditableProfileState) {
  const formData = new FormData();
  const gallerySources = profile.mediaItems
    .map((item) => item.source.trim())
    .filter(isUploadedGallerySource)
    .filter(Boolean)
    .join("\n");

  formData.set("creatorId", profile.id);
  formData.set("about", profile.about);
  formData.set("bio", profile.bio || profile.profileIntro || profile.about);
  formData.set("category", profile.category);
  formData.set("currency", profile.currency);
  formData.set("email", profile.email ?? "");
  formData.set("helpItems", profile.helpItems);
  formData.set("instagramHandle", profile.instagramHandle);
  formData.set(
    "instagramPlatform",
    profile.instagramHandle || profile.tiktokHandle,
  );
  formData.set("location", profile.location);
  formData.set("name", profile.name);
  formData.set("oneToOneReason", profile.oneToOneReason);
  formData.set("offer", profile.offer);
  formData.set("phone", profile.phone);
  formData.set("profileDetails", profile.profileDetails || profile.about);
  formData.set("profileGallery", gallerySources);
  formData.set("profileImageUrl", profile.image);
  formData.set("profileIntro", profile.profileIntro);
  formData.set("seat15Description", profile.seat15Description);
  formData.set("seat15DurationMinutes", String(profile.seat15DurationMinutes));
  formData.set("seat15PriceAmount", String(profile.seat15PriceAmount));
  formData.set("seat30Description", profile.seat30Description);
  formData.set("seat30DurationMinutes", String(profile.seat30DurationMinutes));
  formData.set("seat30PriceAmount", String(profile.seat30PriceAmount));
  formData.set("tiktokHandle", profile.tiktokHandle);
  formData.set("timezone", profile.timezone);

  if (profile.seat15Enabled) {
    formData.set("seat15Enabled", "on");
  }

  if (profile.seat30Enabled) {
    formData.set("seat30Enabled", "on");
  }

  return formData;
}

function isUploadedGallerySource(source: string) {
  return (
    /^data:image\//i.test(source) ||
    /^data:video\//i.test(source) ||
    /^\/[^?#]+\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(source) ||
    /^\/[^?#]+\.(?:m4v|mov|mp4|webm)(?:[?#].*)?$/i.test(source) ||
    /^https?:\/\/[^?#]+\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(source) ||
    /^https?:\/\/[^?#]+\.(?:m4v|mov|mp4|webm)(?:[?#].*)?$/i.test(source)
  );
}

function getPercentValue(value: number | string | undefined) {
  const numericValue =
    typeof value === "string" ? Number.parseFloat(value) : value;

  if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
    return 50;
  }

  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function getZoomValue(value: number | string | undefined) {
  const numericValue =
    typeof value === "string" ? Number.parseFloat(value) : value;

  if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
    return 135;
  }

  return Math.min(220, Math.max(100, Math.round(numericValue)));
}

function getProfileImagePointerDistance(
  pointers: Map<number, ProfileImagePointer>,
) {
  const [first, second] = Array.from(pointers.values());

  if (!first || !second) {
    return 0;
  }

  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getGestureScale(event: Event) {
  const gesture = event as Event & { scale?: number };

  return typeof gesture.scale === "number" && Number.isFinite(gesture.scale)
    ? gesture.scale
    : 1;
}

function normalizeSocialUrlForHref(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );

    if (!isInstagramHost(url.hostname) && !isTikTokHost(url.hostname)) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function getSocialHandleFromUrl(value: string) {
  const href = normalizeSocialUrlForHref(value);

  if (!href) {
    return "";
  }

  try {
    const url = new URL(href);
    const firstPathPart = url.pathname
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)[0];

    if (!firstPathPart || ["p", "reel", "tv", "video"].includes(firstPathPart)) {
      return "";
    }

    return firstPathPart.startsWith("@") ? firstPathPart : `@${firstPathPart}`;
  } catch {
    return "";
  }
}

function isSocialMediaUrl(source: string) {
  return isInstagramUrl(source) || isTikTokUrl(source);
}

function isInstagramUrl(source: string) {
  const href = normalizeSocialUrlForHref(source);

  if (!href) {
    return false;
  }

  return isInstagramHost(new URL(href).hostname);
}

function isTikTokUrl(source: string) {
  const href = normalizeSocialUrlForHref(source);

  if (!href) {
    return false;
  }

  return isTikTokHost(new URL(href).hostname);
}

function isInstagramHost(hostname: string) {
  return /(^|\.)instagram\.com$/i.test(hostname);
}

function isTikTokHost(hostname: string) {
  return /(^|\.)tiktok\.com$/i.test(hostname);
}

function isTikTokVideoSource(source: string) {
  return Boolean(getTikTokVideoId(source));
}

function getVideoEmbedSource(source: string) {
  const trimmed = source.trim();
  const id = getTikTokVideoId(trimmed);

  if (id) {
    return `https://www.tiktok.com/player/v1/${id}?${tiktokPlayerOptions}`;
  }

  return trimmed;
}

function getTikTokVideoId(source: string) {
  const trimmed = source.trim();
  const bareId = trimmed.match(/^(\d{10,})$/)?.[1];

  if (bareId) {
    return bareId;
  }

  try {
    const url = new URL(trimmed);

    if (!/(^|\.)tiktok\.com$/i.test(url.hostname)) {
      return null;
    }

    return url.pathname.match(/\/video\/(\d{10,})/)?.[1] ?? null;
  } catch {
    return null;
  }
}
