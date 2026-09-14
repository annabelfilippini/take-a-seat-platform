"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { CREATOR_PROFILE_EDITOR_URL } from "../../_lib/creator-destination";
import { CreatorSetupPagePreview } from "../../_components/CreatorSetupPagePreview";

type EditableGalleryItem = {
  fileName?: string;
  id: string;
  kind: "photo" | "video";
  source: string;
  sourceKind?: "upload" | "url";
  title: string;
};

type EditableCreatorTab = "profile" | "availability" | "payments" | "publish" | "settings";
type EditableDurationValue = number | string;
type EditablePriceValue = number | string;
type ProfileImagePointer = {
  x: number;
  y: number;
};

type EditableProfileState = {
  publishedAt?: string | null;
  publicSlug?: string | null;
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
  { id: "publish", label: "Go live" },
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
  calendarStatus,
  stripeStatus,
  initialAvailabilityRules = [],
  initialProfile,
  initialNotificationPreferences = defaultNotificationPreferences,
  initialNotifications = [],
}: {
  calendarStatus?: string;
  stripeStatus?: string;
  initialAvailabilityRules?: EditableAvailabilityRule[];
  initialProfile: EditableProfileState;
  initialNotificationPreferences?: EditableNotificationPreferences;
  initialNotifications?: EditableCreatorNotification[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [activeCreatorTab, setActiveCreatorTab] =
    useState<EditableCreatorTab>(calendarStatus ? "availability" : stripeStatus ? "payments" : "profile");
  const previewDialog = useRef<HTMLDialogElement>(null);
  const [publishMessage, setPublishMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [hasAvailability, setHasAvailability] = useState(initialAvailabilityRules.some((rule) => rule.enabled !== false));
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
  const profileEditRevision = useRef(0);
  const profileSaveInFlight = useRef(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const profileSaveLabel =
    profileSaving
      ? "Saving"
      : mediaSaveStatus === "saved"
        ? "Saved"
        : mediaSaveStatus === "error"
          ? "Save failed"
          : "Unsaved";

  useEffect(() => {
    function warnOnLeave(event: BeforeUnloadEvent) {
      if (mediaSaveStatus !== "saved") { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", warnOnLeave);
    return () => window.removeEventListener("beforeunload", warnOnLeave);
  }, [mediaSaveStatus]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>(".creator-setup-editor h1")?.focus({ preventScroll: true });
  }, [activeCreatorTab]);

  const markProfileDirty = useCallback(() => {
    profileEditRevision.current += 1;
    setMediaSaveStatus("idle");
  }, []);

  const updateProfileImageZoom = useCallback((value: number) => {
    markProfileDirty();
    setProfile((current) => ({
      ...current,
      profileImageZoom: getZoomValue(value),
    }));
  }, [markProfileDirty]);

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
  }, [profile.image, profileImageZoom, updateProfileImageZoom]);


  function update<K extends keyof EditableProfileState>(
    key: K,
    value: EditableProfileState[K],
  ) {
    markProfileDirty();
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateSocialUrl(
    key: "instagramUrl" | "tiktokUrl",
    value: string,
  ) {
    markProfileDirty();
    setProfile((current) => ({
      ...current,
      [key]: value,
      ...(key === "instagramUrl"
        ? { instagramHandle: getSocialHandleFromUrl(value) }
        : { tiktokHandle: getSocialHandleFromUrl(value) }),
    }));
  }

  function chooseMediaItemFile(id: string, file: File | undefined) {
    if (!file || !isSupportedMediaFile(file)) {
      return;
    }

    readFileAsDataUrl(file, (source) => {
      markProfileDirty();
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
    markProfileDirty();
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
    markProfileDirty();
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
      markProfileDirty();
      setProfileImageFileName(file.name);
    });
  }

  function updateProfileImagePosition(next: {
    x?: number | string;
    y?: number | string;
  }) {
    markProfileDirty();
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

  function adjustProfileImageZoom(delta: number) {
    markProfileDirty();
    setProfile((current) => ({
      ...current,
      profileImageZoom: getZoomValue(getZoomValue(current.profileImageZoom) + delta),
    }));
  }

  function panProfileImage(deltaX: number, deltaY: number) {
    markProfileDirty();
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

  async function saveProfileChanges() {
    if (profileSaveInFlight.current) {
      return false;
    }

    profileSaveInFlight.current = true;
    const savedRevision = profileEditRevision.current;
    setProfileSaving(true);
    setMediaSaveStatus("saving");

    try {
      const response = await fetch("/api/creators/profile", {
        body: getProfileSettingsFormData(profile),
        headers: { accept: "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Profile save failed.");
      }

      setMediaSaveStatus(
        profileEditRevision.current === savedRevision ? "saved" : "idle",
      );
      return profileEditRevision.current === savedRevision;
    } catch {
      setMediaSaveStatus("error");
      return false;
    } finally {
      profileSaveInFlight.current = false;
      setProfileSaving(false);
    }
  }

  async function changeStep(step: EditableCreatorTab) {
    if (profileSaving || publishing) return;
    if (mediaSaveStatus !== "saved" && !(await saveProfileChanges())) return;
    setActiveCreatorTab(step);
    setPublishMessage("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function publishProfile() {
    setPublishing(true);
    setPublishMessage("");
    try {
      if (!(await saveProfileChanges())) throw new Error("Save your draft successfully before publishing.");
      const body = getProfileSettingsFormData(profile);
      body.set("intent", "publish");
      const response = await fetch("/api/creators/profile", { method: "POST", headers: { accept: "application/json" }, body });
      const result = await response.json() as { detail?: string; publicPath?: string };
      if (!response.ok) throw new Error(result.detail || "Publishing failed. Please try again.");
      setProfile((current) => ({ ...current, publishedAt: new Date().toISOString() }));
      setPublishMessage("Your page is live. You can share it now.");
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Publishing failed. Your draft is saved.");
    } finally {
      setPublishing(false);
    }
  }

  const profileReady = Boolean(profile.name.trim() && profile.about.trim() && profile.helpItems.trim() && profile.image);
  const enabledCalls = [
    { enabled: profile.seat15Enabled, price: Number(profile.seat15PriceAmount) },
    { enabled: profile.seat30Enabled, price: Number(profile.seat30PriceAmount) },
  ].filter((call) => call.enabled);
  const callsReady = enabledCalls.length > 0 && enabledCalls.every((call) => call.price > 0);
  const setupChecks = [
    { id: "profile" as const, label: "Profile picture, about text, and conversation topics", done: profileReady },
    { id: "profile" as const, label: "Call lengths and prices", done: callsReady },
    { id: "availability" as const, label: "Saved availability and Google Calendar", done: hasAvailability && Boolean(profile.calendarConnectedAt) },
    { id: "payments" as const, label: "Stripe payouts connected", done: Boolean(profile.stripeConnectedAt) },
  ];
  const allReady = setupChecks.every((check) => check.done);
  const helpItems = profile.helpItems ? profile.helpItems.split("\n") : ["", "", "", ""];

  return (
    <main className="platform-shell amber-profile-page editable-profile-page">
      {calendarStatus ? (
        <p role={calendarStatus === "connected" && profile.calendarConnectedAt ? "status" : "alert"} className="calendar-connection-notice">
          {calendarStatus === "connected" && profile.calendarConnectedAt ? "Google Calendar connected. Your saved hours will be checked for calendar conflicts."
            : calendarStatus === "cancelled" ? "Calendar connection was cancelled. You can connect again when you are ready."
              : "Google Calendar could not connect. Please try Connect calendar again. Your saved profile has not changed."}
        </p>
      ) : null}

      <div className="profile-announcement">{profile.publishedAt ? "Live page · private edits" : "Your creator profile · Private draft"}</div>
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
              disabled={profileSaving || publishing}
              onClick={() => { void changeStep(tab.id); }}
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
      <fieldset className="creator-setup-fields" disabled={publishing}>
      <section className="amber-profile-hero editable-public-preview" id="public-preview">
        <div className="amber-hero-copy">
          <div className="editable-profile-photo-editor">
            <span
              aria-label={profile.image ? "Drag profile picture to reposition it" : "Profile picture placeholder"}
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
            <details className="editable-profile-photo-controls">
              <summary>Profile photo</summary>
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
            </details>
          </div>
          <EditableTextarea
            ariaLabel="Creator hero name"
            className="editable-profile-title"
            rows={2}
            value={profile.name}
            onChange={(value) => update("name", value)}
          />
          <details className="editable-social-url-fields">
            <summary>Social links</summary>
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
          </details>
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
          </p>
          <EditableTextarea
            ariaLabel="Public profile intro"
            className="editable-profile-paragraph"
            rows={4}
            value={profile.profileIntro}
            onChange={(value) => update("profileIntro", value)}
          />
          <a className="seat-primary-button profile-primary-button" href="#reserve">Choose a call</a>
        </div>

        <div className="editable-gallery-column">
          <EditableMediaGallery items={profile.mediaItems} name={profile.name} />
          <details className="editable-gallery-controls">
            <summary>Photos and videos</summary>
        <div className="editable-media-panel">
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
                {profileSaveLabel}
              </span>
              <button
                className="editable-primary-button editable-save-button"
                disabled={profileSaving}
                onClick={saveProfileChanges}
                type="button"
              >
                {profileSaving ? "Saving profile" : "Save draft"}
              </button>
            </div>
          </div>
          <div className="editable-social-accounts">
            <label>
              <span>Location</span>
              <input aria-label="Location" className="editable-profile-field editable-basic-input" value={profile.location} onChange={(event) => update("location", event.target.value)} />
            </label>
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
          </details>
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
            <h3>{profile.name.split(" ")[0] || "Creator"} <span>can help with</span></h3>
            <ul className="editable-help-topics">
              {helpItems.map((item, index) => (
                <li key={index}>
                  <EditableTextarea
                    ariaLabel={index === 0 ? "What people can ask" : `Help topic ${index + 1}`}
                    className="editable-help-topic"
                    rows={2}
                    value={item}
                    onChange={(value) => update("helpItems", helpItems.map((topic, topicIndex) => topicIndex === index ? value : topic).join("\n"))}
                  />
                </li>
              ))}
            </ul>
            <button className="editable-secondary-button" type="button" onClick={() => update("helpItems", [...helpItems, ""].join("\n"))}>Add topic</button>
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
          <h2 className="editable-reserve-heading">Choose a call</h2>
          <p>Private video call on Google Meet.</p>
          <label className="editable-call-currency">Currency<select aria-label="Call currency" value={profile.currency} onChange={(event) => update("currency", event.target.value)}>{["USD", "GBP", "EUR", "CAD", "AUD"].map((currency) => <option key={currency}>{currency}</option>)}</select></label>
          <div className="seat-options">
            <EditableSeatOption
              currency={profile.currency}
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
              currency={profile.currency}
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
          <button className="seat-primary-button editable-preview-booking-button" disabled type="button">
            Find availability
          </button>
          <p className="reserve-note editable-reserve-note">No account needed.</p>
          <p className="reserve-note editable-reserve-note">
            You won&apos;t be charged unless {profile.name.split(" ")[0] || "the creator"} accepts your
            appointment.
          </p>
        </aside>
      </section>
      <section className="editable-profile-save-footer" aria-label="Save profile changes">
        <div className="editable-save-status-group">
          <span
            className={
              mediaSaveStatus === "saved"
                ? "dashboard-status-complete"
                : "dashboard-status"
            }
          >
            {profileSaveLabel}
          </span>
          <button
            className="editable-primary-button editable-save-button"
            disabled={profileSaving}
            onClick={saveProfileChanges}
            type="button"
          >
            {profileSaving ? "Saving profile" : "Save draft"}
          </button>
        </div>
      </section>
      </fieldset>
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
          onSaved={(hasHours, timezone, advance) => { setHasAvailability(hasHours); setProfile((current) => ({ ...current, timezone })); if (advance) setActiveCreatorTab("payments"); }}
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
          onEditProfile={() => { void changeStep("profile"); }}
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
          <section hidden={activeCreatorTab !== "publish"} className="editable-admin-tab-panel" role="tabpanel" aria-labelledby="editable-creator-tab-publish" aria-label="Go live" id="editable-creator-publish">
            <p>Review your page and finish these steps before publishing. Your profile and call prices stay private until you publish.</p>
            <ul className="creator-setup-checklist">{setupChecks.map((check) => <li key={check.label}><span>{check.done ? "Ready" : "To do"}</span><button type="button" onClick={() => { void changeStep(check.id); }}>{check.label}</button></li>)}</ul>
            <button type="button" className="seat-secondary-button" onClick={() => previewDialog.current?.showModal()}>Preview your page</button>
            <footer className="creator-setup-footer"><button type="button" className="editable-primary-button" disabled={!allReady || publishing || profileSaving} onClick={() => { void publishProfile(); }}>{publishing ? "Publishing…" : profile.publishedAt ? "Publish changes" : "Go live"}</button></footer>
            {publishMessage ? <p role="status">{publishMessage}</p> : null}
            {profile.publishedAt && profile.publicSlug ? <a href={`/with/${profile.publicSlug}`} target="_blank" rel="noreferrer">View your live page ↗</a> : null}
          </section>
      <dialog className="creator-full-preview" ref={previewDialog} aria-label="Preview your public page"><div className="creator-preview-toolbar"><span>Draft preview</span><button type="button" onClick={() => previewDialog.current?.close()}>Back to setup</button></div><CreatorSetupPagePreview profile={profile} /></dialog>
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
  onSaved,
}: {
  calendarConnectedAt?: string | null;
  creatorId: string;
  initialRules: EditableAvailabilityRule[];
  timezone: string;
  onSaved: (hasHours: boolean, timezone: string, advance: boolean) => void;
}) {
  const calendarConnected = Boolean(calendarConnectedAt);
  const [timezone, setTimezone] = useState(initialRules[0]?.timezone ?? initialTimezone);
  const [selectedSlots, setSelectedSlots] = useState(
    () => new Set(getAvailabilitySlotKeysFromRules(initialRules)),
  );
  const [saveStatus, setSaveStatus] = useState<"error" | "idle" | "saved" | "saving">(
    initialRules.length > 0 ? "saved" : "idle",
  );
  const paintActionRef = useRef<"clear" | "select" | null>(null);
  const paintStartRef = useRef<{ dayOfWeek: number; slotIndex: number } | null>(null);
  const paintedSlotsRef = useRef<Set<string>>(new Set());

  function paintSlot(key: string, action: "clear" | "select") {
    if (paintedSlotsRef.current.has(key)) {
      return;
    }

    paintedSlotsRef.current.add(key);

    setSelectedSlots((current) => {
      const nextSlots = new Set(current);

      if (action === "clear") {
        nextSlots.delete(key);
      } else {
        nextSlots.add(key);
      }

      return nextSlots;
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
    if (saveStatus === "saving" || event.pointerType === "touch" || event.button !== 0) {
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

  async function saveAvailability(advance = true) {
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
      onSaved(selectedSlots.size > 0, timezone, advance);
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }

  return (
    <div className="editable-editor-panel editable-wide-editor-panel">
      <div className="creator-form-header">
        <div className="editable-section-heading">
          <h2>Weekly availability</h2>
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
            onClick={async (event) => {
              event.preventDefault();
              const href = event.currentTarget.href;
              if (saveStatus !== "saving" && await saveAvailability(false)) window.location.assign(href);
            }}
            href={`/api/google-calendar/oauth/start?creatorId=${encodeURIComponent(
              creatorId,
            )}&returnTo=${CREATOR_PROFILE_EDITOR_URL}`}
          >
            {calendarConnected ? "Calendar connected" : "Connect calendar"}
          </a>
        </div>
      </div>

      <p className="availability-instructions" id="weekly-availability-help">
        These hours repeat every week in your selected timezone. Select the times
        you can take calls, then save your availability. Tap a time to select it,
        or use a mouse to drag across several times.
      </p>

      <div className="availability-settings-row">
        <label className="availability-timezone-picker">
          <span>Timezone</span>
          <input
            className="editable-profile-field editable-basic-input"
            disabled={saveStatus === "saving"}
            list="creator-timezone-options"
            placeholder="Search timezone"
            value={timezone}
            onChange={(event) => {
              setTimezone(event.target.value);
              setSaveStatus("idle");
            }}
          />
          <datalist id="creator-timezone-options">
            {timezoneOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="creator-availability-box">
        <div className="availability-calendar" aria-describedby="weekly-availability-help">
          <div className="availability-days-row">
            <span className="availability-grid-corner">Time</span>
            {availabilityDays.map((day) => (
              <span className="availability-day-heading" key={day.value}>
                <strong>{day.label}</strong>
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
                disabled={saveStatus === "saving"}
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
        disabled={saveStatus === "saving"}
        onClick={() => { void saveAvailability(); }}
        type="button"
      >
        {saveStatus === "saving" ? "Saving availability" : "Save and continue"}
      </button>
    </div>
  );
}

function EditableAvailabilityRow({
  disabled,
  selectedSlots,
  slot,
  slotIndex,
  toggleSlot,
}: {
  disabled: boolean;
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
            disabled={disabled}
            key={day.value}
            onPointerUp={(event) => {
              // Scrolling cancels touch pointers; only a completed tap toggles.
              if (event.pointerType === "touch" && !disabled) {
                toggleSlot(day.value, slot.value);
              }
            }}
            onClick={(event) => {
              // Pointer selection is handled above; native clicks cover
              // keyboard and assistive input without toggling a pointer twice.
              if (event.detail === 0) {
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
          Edit call prices
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

  if (!items.length) return (
    <div className="amber-hero-gallery editable-empty-gallery" aria-label={`${name} photos and videos`}>
      <div className="amber-gallery-track">
        <span className="amber-gallery-frame">Photo or video</span>
        <span className="amber-gallery-frame">Photo or video</span>
      </div>
    </div>
  );

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
  currency,
  description,
  durationMinutes,
  enabled,
  price,
  onDescriptionChange,
  onDurationChange,
  onEnabledChange,
  onPriceChange,
}: {
  currency: string;
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
      <div className="seat-option-heading editable-seat-option-heading">
        <label className="editable-duration-field editable-seat-duration-field">
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
        <label className="editable-price-field editable-seat-price-field">
          <span>{currency === "USD" ? "$" : currency}</span>
          <input
            aria-label={`${label} price`}
            inputMode="decimal"
            step="0.01"
            min="0"
            type="number"
            value={price}
            onChange={(event) => onPriceChange(event.target.value)}
          />
        </label>
      </div>
      <EditableTextarea
        ariaLabel={`${label} description`}
        className="editable-seat-description"
        rows={3}
        value={description}
        onChange={onDescriptionChange}
      />
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

function getAvailabilitySlotKeysFromRules(rules: EditableAvailabilityRule[]) {
  const slotKeys = rules.flatMap((rule) => {
    if (rule.enabled === false) {
      return [];
    }

    return availabilityTimeSlots
      .filter((slot) => slot.value >= rule.startTime && slot.value < rule.endTime)
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
      placeholder={ariaLabel}
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
  formData.set("bio", profile.profileIntro || profile.about);
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
  formData.set(
    "profileImagePositionX",
    String(getPercentValue(profile.profileImagePositionX)),
  );
  formData.set(
    "profileImagePositionY",
    String(getPercentValue(profile.profileImagePositionY)),
  );
  formData.set("profileImageUrl", profile.image);
  formData.set("profileImageZoom", String(getZoomValue(profile.profileImageZoom)));
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
