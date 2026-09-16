"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { CreatorOfferingsEditor } from "../../_components/CreatorOfferingsEditor";
import { CreatorRequestsPanel } from "../../_components/CreatorRequestsPanel";
import { CreatorPaymentsPanel } from "../../_components/CreatorPaymentsPanel";
import type { Offering } from "../../_lib/offerings";
import { CREATOR_PROFILE_EDITOR_URL } from "../../_lib/creator-destination";

import { prepareProfileMedia } from "../../_lib/profile-media";
import { profileSaveError } from "../../_lib/profile-save";
import {
  addCalendarDays,
  availabilityDateBounds,
  availabilityWeekStart,
  rulesForAvailabilityWeek,
} from "../../_lib/availability-weeks";

type EditableGalleryItem = {
  fileName?: string;
  id: string;
  kind: "photo" | "video";
  source: string;
  sourceKind?: "upload" | "url";
  title: string;
};

type EditableCreatorTab = "profile" | "availability" | "payments" | "publish" | "requests";
type EditableDurationValue = number | string;
type EditablePriceValue = number | string;
type ProfileImagePointer = {
  x: number;
  y: number;
};

type EditableProfileState = {
  offerings?: Offering[];
  draftSavedAt?: string | null;
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
  weekStart?: string | null;
};

const creatorTabs: Array<{ id: EditableCreatorTab; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "availability", label: "Availability" },
  { id: "requests", label: "Requests" },
  { id: "payments", label: "Payments" },
  { id: "publish", label: "Preview & Publish" },
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

const subscribeHydration = () => () => {};

export function EditableCreatorProfilePreview({
  calendarStatus,
  initialCalendarState = "not-connected",
  stripeStatus,
  initialAvailabilityRules = [],
  initialProfile,
  initialNotificationPreferences = defaultNotificationPreferences,
  initialNotifications = [],
}: {
  calendarStatus?: string;
  initialCalendarState?: "connected" | "needs-attention" | "not-connected";
  stripeStatus?: string;
  initialAvailabilityRules?: EditableAvailabilityRule[];
  initialProfile: EditableProfileState;
  initialNotificationPreferences?: EditableNotificationPreferences;
  initialNotifications?: EditableCreatorNotification[];
}) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [profile, setProfile] = useState(initialProfile);
  const [calendarState, setCalendarState] = useState(initialCalendarState);
  const [stripeReady, setStripeReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(initialProfile.draftSavedAt);
  const [uploadState, setUploadState] = useState("");
  const uploadBusy = useRef(false);
  const [activeCreatorTab, setActiveCreatorTab] =
    useState<EditableCreatorTab>(calendarStatus ? "availability" : stripeStatus ? "payments" : "profile");
  const previewDialog = useRef<HTMLDialogElement>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  async function openPreview() {
    if (!await saveProfileChanges()) return;
    setPreviewRevision((revision) => revision + 1);
    previewDialog.current?.showModal();
  }
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
  const draftRevision = useRef(initialProfile.draftSavedAt ?? null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");
  const profileSaveLabel =
    profileSaving
      ? "Saving"
      : mediaSaveStatus === "saved"
        ? lastSavedAt ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString("en-US", {hour:"numeric",minute:"2-digit",timeZone:profile.timezone})}` : "No changes"
        : mediaSaveStatus === "error"
          ? "Save failed"
          : "Unsaved changes";

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

  async function uploadFile(file: File, onLoad: (source: string) => void) {
    if (uploadBusy.current) return;
    uploadBusy.current = true; setUploadState("Uploading…");
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Choose a file up to 8 MB.");
      const body = new FormData(); body.set("creatorId", profile.id); body.set("file", file);
      const response = await fetch("/api/creators/media", { method: "POST", body });
      const result = await response.json() as {source?:string;error?:string};
      if (!response.ok || !result.source) throw new Error(result.error || "Upload failed. Please retry.");
      onLoad(result.source); setUploadState("Upload ready. Save your draft to keep this selection.");
    } catch (error) { setUploadState(error instanceof Error ? error.message : "Upload failed. Please retry."); }
    finally { uploadBusy.current = false; }
  }

  function chooseMediaItemFile(id: string, file: File | undefined) {
    if (!file) return;
    if (!isSupportedMediaFile(file)) {
      setUploadState("Use a JPG, PNG, WebP photo or MP4/WebM video.");
      return;
    }

    void uploadFile(file, (source) => {
      if (profile.mediaItems.some((item) => item.id !== id && item.source === source)) throw new Error("That file is already in your gallery.");
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

    if (!source || profile.mediaItems.length >= 8 || profile.mediaItems.some((item) => item.source === source)) {
      return;
    }

    setProfile((current) => ({
      ...current,
      mediaItems: current.mediaItems.some((item) => item.source === source) ? current.mediaItems : [
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
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setUploadState("Choose a JPG, PNG or WebP profile photo."); return; }

    void uploadFile(file, (source) => {
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
    if (!file) return;
    if (!isSupportedMediaFile(file)) {
      setUploadState("Use a JPG, PNG, WebP photo or MP4/WebM video.");
      return;
    }

    setDraftMedia((current) => ({ ...current, uploadedSource: "" }));
    void uploadFile(file, (source) => {
      if (profile.mediaItems.some((item) => item.source === source)) throw new Error("That file is already in your gallery.");
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
    if (profileSaveInFlight.current || uploadBusy.current) {
      return false;
    }

    profileSaveInFlight.current = true;
    const savedRevision = profileEditRevision.current;
    setProfileSaving(true);
    setMediaSaveStatus("saving");
    setProfileSaveMessage("");

    try {
      const [image, ...sources] = await prepareProfileMedia([profile.image, ...profile.mediaItems.map((item) => item.source)]);
      const preparedProfile = { ...profile, image, mediaItems: profile.mediaItems.map((item, index) => ({ ...item, source: sources[index] })) };
      const body = getProfileSettingsFormData(preparedProfile);
      body.set("expectedDraftSavedAt", draftRevision.current ?? "");
      const response = await fetch("/api/creators/profile", {
        body,
        headers: { accept: "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json().catch(() => null) as { status?: string; detail?: string; draftSavedAt?: string } | null;
      if (!response.ok || result?.status !== "saved") {
        throw new Error(profileSaveError(result?.detail, response.status));
      }

      draftRevision.current = result.draftSavedAt ?? draftRevision.current;
      if (profileEditRevision.current === savedRevision) {
        setProfile((current) => ({ ...current, image, mediaItems: preparedProfile.mediaItems }));
      }
      setUploadState("");
      setLastSavedAt(result.draftSavedAt ?? new Date().toISOString());
      setMediaSaveStatus(
        profileEditRevision.current === savedRevision ? "saved" : "idle",
      );
      return profileEditRevision.current === savedRevision;
    } catch (error) {
      setMediaSaveStatus("error");
      setProfileSaveMessage(error instanceof Error && error.name === "Error" ? error.message : profileSaveError());
      return false;
    } finally {
      profileSaveInFlight.current = false;
      setProfileSaving(false);
    }
  }

  function changeStep(step: EditableCreatorTab) {
    if (publishing) return;
    setActiveCreatorTab(step);
    setPublishMessage("");
    window.scrollTo({ top: 0, behavior: "instant" });
    // Every panel stays mounted. Saving must never gate in-page navigation.
    if (mediaSaveStatus === "idle" && !profileSaveInFlight.current) void saveProfileChanges();
  }

  async function publishProfile() {
    setPublishing(true);
    setPublishMessage("");
    try {
      if (!(await saveProfileChanges())) throw new Error("Save your draft successfully before publishing.");
      const body = new FormData();
      body.set("creatorId", profile.id);
      body.set("email", profile.email ?? "");
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
  const enabledCalls = profile.offerings ? profile.offerings.filter((item) => item.active && !item.archived).map((item) => ({ enabled: true, price: item.unitAmount })) : [
    { enabled: profile.seat15Enabled, price: Number(profile.seat15PriceAmount) },
    { enabled: profile.seat30Enabled, price: Number(profile.seat30PriceAmount) },
  ].filter((call) => call.enabled);
  const callsReady = enabledCalls.length > 0 && enabledCalls.every((call) => call.price > 0);
  const setupChecks = [
    { id: "profile" as const, label: "Profile picture, about text, and conversation topics", done: profileReady },
    { id: "profile" as const, label: "Call lengths and prices", done: callsReady },
    { id: "availability" as const, label: "Saved availability and Google Calendar", done: hasAvailability && (calendarState === "connected") },
    { id: "payments" as const, label: "Stripe payouts connected", done: stripeReady },
  ];
  const allReady = setupChecks.every((check) => check.done);
  const helpItems = profile.helpItems ? profile.helpItems.split("\n") : ["", "", "", ""];

  return (
    <main className="platform-shell amber-profile-page editable-profile-page" inert={!hydrated}>
      {calendarStatus ? (
        <p role={calendarStatus === "connected" && calendarState === "connected" ? "status" : "alert"} className="calendar-connection-notice">
          {calendarStatus === "connected" && calendarState === "connected" ? "Google Calendar connected. Your saved hours will be checked for calendar conflicts."
            : calendarStatus === "cancelled" ? "Calendar connection was cancelled. You can connect again when you are ready."
              : "Google Calendar could not connect. Please try Connect calendar again. Your saved profile has not changed."}
        </p>
      ) : null}

      <div className="profile-announcement">{profile.publishedAt ? "Your storefront · Live · Private draft edits" : "Your storefront · Draft"}</div>
      <header className="topbar profile-topbar">
        <a className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <div className="profile-nav" aria-label="Your storefront" role="tablist">
          {creatorTabs.map((tab) => (
            <button
              aria-label={tab.label}
              aria-controls={`editable-creator-${tab.id}`}
              aria-selected={activeCreatorTab === tab.id}
              className="profile-nav-tab"
              id={`editable-creator-tab-${tab.id}`}
              key={tab.id}
              disabled={!hydrated || publishing}
              onClick={() => { void changeStep(tab.id); }}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="creator-storefront-bar"><span role="status">{uploadState === "Uploading…" ? uploadState : profileSaveLabel}</span><button type="button" onClick={() => void openPreview()}>Preview profile</button></div>
      {profileSaveMessage ? (
        <div className="creator-profile-save-notice" role="alert">
          <p>{profileSaveMessage}</p>
          <button className="editable-primary-button" disabled={profileSaving || publishing} onClick={() => { void saveProfileChanges(); }} type="button">Retry Save draft</button>
        </div>
      ) : null}

      <div
        aria-labelledby="editable-creator-tab-profile"
        hidden={activeCreatorTab !== "profile"}
        id="editable-creator-profile"
        role="tabpanel"
      >
      {uploadState && <p role="status" className="creator-upload-status">{uploadState}</p>}
      <fieldset className="creator-setup-fields" disabled={!hydrated || publishing || uploadState === "Uploading…"}>
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
                  style={{ objectPosition: `${profileImagePositionX}% ${profileImagePositionY}%`, transform: profileImageTransform }}
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
                  onChange={(event) => chooseProfileImage(takeUploadFile(event.currentTarget))}
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
            {profile.mediaItems.map((item, index) => (
              <article className="editable-media-row" key={item.id}>
                <MediaPreview item={item} />
                <div className="editable-media-source-control">
                  <input
                    accept="image/*,video/*"
                    aria-label={`Upload replacement for ${item.title}`}
                    className="editable-profile-field editable-file-input"
                    type="file"
                    onChange={(event) =>
                      chooseMediaItemFile(item.id, takeUploadFile(event.currentTarget))
                    }
                  />
                  {item.sourceKind === "upload" && item.fileName ? (
                    <p className="editable-upload-note">Uploaded {item.fileName}</p>
                  ) : null}
                </div>
                <button type="button" disabled={index === 0} aria-label={`Move media ${index+1} up`} onClick={() => { const next = [...profile.mediaItems]; [next[index-1],next[index]] = [next[index],next[index-1]]; update("mediaItems",next); }}>↑</button>
                <button type="button" disabled={index === profile.mediaItems.length-1} aria-label={`Move media ${index+1} down`} onClick={() => { const next = [...profile.mediaItems]; [next[index+1],next[index]] = [next[index],next[index+1]]; update("mediaItems",next); }}>↓</button>
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

          <p>Up to 8 photos or videos, 8 MB each. JPG, PNG, WebP, MP4 or WebM. Originals are kept so you can recrop later.</p>
          <div className="editable-add-media">
            <div className="editable-add-source">
              <input
                accept="image/*,video/*"
                aria-label="Upload new media file"
                className="editable-profile-field editable-file-input"
                ref={draftMediaFileInputRef}
                type="file"
                onChange={(event) => chooseDraftMediaFile(takeUploadFile(event.currentTarget))}
              />
              {draftMedia.fileName ? (
                <p className="editable-upload-note">Uploaded {draftMedia.fileName}</p>
              ) : null}
            </div>
            <button
              className="editable-primary-button"
              disabled={!draftMedia.uploadedSource || profile.mediaItems.length >= 8 || profile.mediaItems.some((item) => item.source === draftMedia.uploadedSource)}
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
          <p>Share your background, experience, personal style, and what you enjoy helping people feel confident about.</p>
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
            <button className="editable-secondary-button" type="button" disabled={helpItems.length >= 5} onClick={() => update("helpItems", [...helpItems, ""].join("\n"))}>Add topic</button>
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
          <CreatorOfferingsEditor offerings={profile.offerings ?? []} onChange={(items) => update("offerings",items)} />
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
          calendarState={calendarState}
          onCalendarState={setCalendarState}
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
        <CreatorPaymentsPanel creatorId={profile.id} onReadiness={setStripeReady} />
      </section>

      <section
        aria-labelledby="editable-creator-tab-requests"
        className="editable-admin-tab-panel"
        hidden={activeCreatorTab !== "requests"}
        id="editable-creator-requests"
        role="tabpanel"
      >
        <CreatorRequestsPanel creatorId={profile.id} />
        <details className="creator-notification-settings"><summary>Notification preferences</summary><EditableSettingsPanel
          creatorId={profile.id}
          initialNotifications={initialNotifications}
          initialPreferences={initialNotificationPreferences}
        /></details>
      </section>
          <section hidden={activeCreatorTab !== "publish"} className="editable-admin-tab-panel" role="tabpanel" aria-labelledby="editable-creator-tab-publish" aria-label="Preview & Publish" id="editable-creator-publish">
            <h1>Preview & Publish</h1><p>Review your page and finish these steps before publishing. Your profile and call prices stay private until you publish.</p>
            <ul className="creator-setup-checklist">{setupChecks.map((check) => <li key={check.label}><span>{check.done ? "Ready" : "To do"}</span><button type="button" onClick={() => { void changeStep(check.id); }}>{check.label}</button></li>)}</ul>
            {!stripeReady && <p>Connect Stripe before accepting paid sessions.</p>}
            <button type="button" className="seat-secondary-button" onClick={() => void openPreview()}>Preview your page</button>
            <footer className="creator-setup-footer"><button type="button" className="editable-primary-button" disabled={!allReady || publishing || profileSaving} onClick={() => { void publishProfile(); }}>{publishing ? "Publishing…" : profile.publishedAt ? "Publish changes" : "Publish profile"}</button></footer>
            {publishMessage ? <p role="status">{publishMessage}</p> : null}
            {profile.publishedAt && profile.publicSlug ? <a href={`/with/${profile.publicSlug}`} target="_blank" rel="noreferrer">View your live page ↗</a> : null}
          </section>
      <dialog className="creator-full-preview" ref={previewDialog} aria-label="Preview your public page"><div className="creator-preview-toolbar"><span>Draft preview</span><button type="button" onClick={() => previewDialog.current?.close()}>Back to setup</button></div>{previewRevision > 0 && <iframe title="Your customer profile preview" src={`/creator/preview?revision=${previewRevision}`} />}</dialog>
    </main>
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
  calendarState,
  onCalendarState,
  creatorId,
  initialRules,
  timezone: initialTimezone,
  onSaved,
}: {
  calendarState: "connected" | "needs-attention" | "not-connected";
  onCalendarState: (state: "connected" | "needs-attention" | "not-connected") => void;
  creatorId: string;
  initialRules: EditableAvailabilityRule[];
  timezone: string;
  onSaved: (hasHours: boolean, timezone: string, advance: boolean) => void;
}) {
  const [calendarMessage, setCalendarMessage] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch(`/api/google-calendar/status?creatorId=${encodeURIComponent(creatorId)}`, { cache: "no-store" });
        if (response.ok) onCalendarState((await response.json() as { state: typeof calendarState }).state);
        else onCalendarState("needs-attention");
      } catch { onCalendarState("needs-attention"); }
    };
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [creatorId, onCalendarState]);
  async function disconnectCalendar() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/google-calendar/disconnect", { method: "POST", body: new URLSearchParams({ creatorId }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { state: typeof calendarState; message: string };
      onCalendarState(result.state); setCalendarMessage(result.message);
    } catch { setCalendarMessage("Calendar could not disconnect. Please try again."); }
    finally { setDisconnecting(false); }
  }

  const initialBounds = availabilityDateBounds(initialTimezone);
  const initialWeekStart = availabilityWeekStart(initialBounds.today);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const weekRules = rulesForAvailabilityWeek(initialRules, weekStart);
  const isDefaultWeek = weekStart === "default";
  const displayWeekStart = isDefaultWeek ? initialWeekStart : weekStart;
  const [timezone, setTimezone] = useState(weekRules[0]?.timezone ?? initialTimezone);
  let availabilityBounds = initialBounds;
  try {
    availabilityBounds = availabilityDateBounds(timezone);
  } catch {
    availabilityBounds = initialBounds;
  }
  const weekOptions = useMemo(
    () => getAvailabilityWeekOptions(availabilityBounds.today, availabilityBounds.end),
    [availabilityBounds.today, availabilityBounds.end],
  );
  const disabledDays = useMemo(() => new Set(
    (isDefaultWeek ? [] : availabilityDays)
      .filter((day) => {
        const date = addCalendarDays(weekStart, day.value);
        return date < availabilityBounds.today || date > availabilityBounds.end;
      })
      .map((day) => day.value),
  ), [availabilityBounds.end, availabilityBounds.today, weekStart, isDefaultWeek]);
  const [weekDrafts, setWeekDrafts] = useState<Record<string, string[]>>({});
  const [weekSavedSlots, setWeekSavedSlots] = useState<Record<string, string[]>>({});
  const [weekTimezones, setWeekTimezones] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const saveInFlight = useRef(false);
  const [selectedSlots, setSelectedSlots] = useState(
    () => new Set(getAvailabilitySlotKeysFromRules(weekRules)),
  );
  const [saveStatus, setSaveStatus] = useState<"empty" | "error" | "idle" | "saved" | "saving">(
    weekRules.length ? "saved" : "empty",
  );
  const paintActionRef = useRef<"clear" | "select" | null>(null);
  const paintStartRef = useRef<{ dayOfWeek: number; slotIndex: number } | null>(null);
  const paintedSlotsRef = useRef<Set<string>>(new Set());

  const currentWeekIndex = Math.max(0, weekOptions.indexOf(weekStart));
  const selectedWeekLabel = isDefaultWeek ? "default weekly schedule" : formatAvailabilityWeek(weekStart);

  useEffect(() => {
    function warnOnLeave(event: BeforeUnloadEvent) {
      if (Object.keys(weekDrafts).length || saveStatus === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warnOnLeave);
    return () => window.removeEventListener("beforeunload", warnOnLeave);
  }, [weekDrafts, saveStatus]);

  function getSlotKeysForWeek(nextWeekStart: string) {
    return weekDrafts[nextWeekStart]
      ?? weekSavedSlots[nextWeekStart]
      ?? (!initialRules.some((rule) => rule.weekStart === nextWeekStart) ? weekSavedSlots.default : undefined)
      ?? getAvailabilitySlotKeysFromRules(rulesForAvailabilityWeek(initialRules, nextWeekStart));
  }

  function setWeekStatus(nextWeekStart: string, nextSlotKeys: string[]) {
    if (weekDrafts[nextWeekStart]) {
      setSaveStatus("idle");
      return;
    }

    const nextRules = rulesForAvailabilityWeek(initialRules, nextWeekStart);
    setSaveStatus(weekSavedSlots[nextWeekStart] !== undefined || nextSlotKeys.length > 0 || nextRules.length > 0 ? "saved" : "empty");
  }

  function showWeek(nextWeekStart: string) {
    if (!nextWeekStart || nextWeekStart === weekStart) {
      return;
    }

    const nextRules = rulesForAvailabilityWeek(initialRules, nextWeekStart);
    const nextSlotKeys = getSlotKeysForWeek(nextWeekStart);
    setWeekStart(nextWeekStart);
    setTimezone(weekTimezones[nextWeekStart]
      ?? (!initialRules.some((rule) => rule.weekStart === nextWeekStart) ? weekTimezones.default : undefined)
      ?? nextRules[0]?.timezone ?? initialTimezone);
    setSaveError("");
    setSelectedSlots(new Set(nextSlotKeys));
    setWeekStatus(nextWeekStart, nextSlotKeys);
  }

  function updateWeekDraft(nextSlots: Set<string>) {
    setWeekDrafts((current) => ({
      ...current,
      [weekStart]: sortAvailabilitySlotKeys(Array.from(nextSlots)),
    }));
  }

  function paintSlot(key: string, action: "clear" | "select") {
    if (paintedSlotsRef.current.has(key)) {
      return;
    }

    const slot = parseAvailabilitySlotKey(key);
    if (!slot || disabledDays.has(slot.dayOfWeek)) {
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

      updateWeekDraft(nextSlots);
      return nextSlots;
    });
    setSaveStatus("idle");
  }

  function toggleSlot(dayOfWeek: number, startTime: string) {
    if (disabledDays.has(dayOfWeek)) {
      return;
    }

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

  async function saveAvailability(advance = false) {
    if (saveInFlight.current) return false;
    saveInFlight.current = true;
    setSaveStatus("saving");
    setSaveError("");
    const saveableSlots = new Set(
      sortAvailabilitySlotKeys(Array.from(selectedSlots)).filter((key) => {
        const slot = parseAvailabilitySlotKey(key);
        return slot && !disabledDays.has(slot.dayOfWeek);
      }),
    );

    try {
      const response = await fetch("/api/creators/availability", {
        body: getAvailabilityFormData({
          creatorId,
          initialRules: weekRules,
          selectedSlots: saveableSlots,
          timezone,
          weekStart,
        }),
        headers: { accept: "application/json" },
        method: "POST",
      });

      const result = await response.json().catch(() => null) as {status?:string} | null;
      if (!response.ok || result?.status !== "saved") {
        throw new Error(response.status === 401 || response.status === 403
          ? "Your session has expired or you no longer have access. Sign in again to save."
          : "Availability could not be saved. Check the timezone and try again. Your changes are still here.");
      }

      const savedSlotKeys = sortAvailabilitySlotKeys(Array.from(saveableSlots));
      setWeekSavedSlots((current) => ({ ...current, [weekStart]: savedSlotKeys }));
      setWeekTimezones((current) => ({ ...current, [weekStart]: timezone }));
      setSelectedSlots(new Set(savedSlotKeys));
      setWeekDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[weekStart];
        return nextDrafts;
      });
      setSaveStatus("saved");
      const savedWeeks = { ...weekSavedSlots, [weekStart]: savedSlotKeys };
      const hasHours = weekOptions.some((week) => (savedWeeks[week]
        ?? (!initialRules.some((rule) => rule.weekStart === week) ? savedWeeks.default : undefined)
        ?? getAvailabilitySlotKeysFromRules(rulesForAvailabilityWeek(initialRules, week))).length > 0);
      onSaved(hasHours, timezone, advance);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Availability could not be saved. Your changes are still here. Try again.");
      setSaveStatus("error");
      return false;
    } finally {
      saveInFlight.current = false;
    }
  }

  return (
    <div className="editable-editor-panel editable-wide-editor-panel">
      <div className="creator-form-header">
        <div className="editable-section-heading">
          <h2>Weekly availability</h2>
        </div>
        <div className="editable-save-status-group">
          <span role="status" className={saveStatus === "saved" ? "dashboard-status-complete" : "dashboard-status"}>
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
            {calendarState === "not-connected" ? "Connect calendar" : "Reconnect calendar"}
          </a>
          {calendarState !== "not-connected" ? <button type="button" className="seat-secondary-button compact-form-button" disabled={disconnecting} onClick={() => void disconnectCalendar()}>{disconnecting ? "Disconnecting…" : "Disconnect Google Calendar"}</button> : null}
        </div>
      </div>
      <p role="status" data-calendar-state={calendarState}>{calendarState === "connected" ? "Google Calendar connected ✓" : calendarState === "needs-attention" ? "Google Calendar connection needs attention. Reconnect or try again shortly." : "Google Calendar not connected. Connect to accept bookings."}</p>
      {calendarMessage ? <p role="status">{calendarMessage}</p> : null}
      <button className="editable-primary-button" type="button" disabled={saveStatus === "saving"} onClick={() => void saveAvailability()}>Save availability</button>
      <div className="availability-settings-row">
        <div className="availability-week-controls" aria-label="Availability week">
          <button
            aria-label="Previous availability week"
            className="availability-week-step"
            disabled={isDefaultWeek || saveStatus === "saving" || currentWeekIndex <= 0}
            onClick={() => showWeek(weekOptions[currentWeekIndex - 1])}
            type="button"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <label className="availability-week-picker">
            <span>Week</span>
            <select
              aria-label="Choose availability week"
              className="editable-profile-field editable-basic-input"
              disabled={saveStatus === "saving"}
              value={weekStart}
              onChange={(event) => showWeek(event.target.value)}
            >
              <option value="default">Default weekly hours</option>
              {weekOptions.map((option) => (
                <option key={option} value={option}>
                  Week of {formatAvailabilityDate(option)}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="Next availability week"
            className="availability-week-step"
            disabled={isDefaultWeek || saveStatus === "saving" || currentWeekIndex >= weekOptions.length - 1}
            onClick={() => showWeek(weekOptions[currentWeekIndex + 1])}
            type="button"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
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
              setWeekTimezones((current) => ({ ...current, [weekStart]: event.target.value }));
              updateWeekDraft(selectedSlots);
              setSaveError("");
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
        <div className="availability-calendar">
          <div className="availability-days-row">
            <span className="availability-grid-corner">Time</span>
            {availabilityDays.map((day) => {
              const date = addCalendarDays(displayWeekStart, day.value);
              return (
              <span
                className={`availability-day-heading${date === availabilityBounds.today ? " active" : ""}`}
                key={day.value}
              >
                <strong>{day.label}</strong>
                <span>{formatAvailabilityDate(date)}</span>
              </span>
              );
            })}
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
                disabledDays={disabledDays}
                key={slot.value}
                selectedSlots={selectedSlots}
                slot={slot}
                slotIndex={slotIndex}
                weekStart={displayWeekStart}
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
        {saveStatus === "saving" ? "Saving availability…" : "Save availability"}
      </button>
      {saveStatus === "saved" && <p role="status">Availability saved for {selectedWeekLabel}.</p>}
      {saveError ? <p role="alert">{saveError}</p> : null}
      {Object.keys(weekDrafts).some((week) => week !== weekStart)
        ? <p role="status">Other weeks have unsaved changes.</p> : null}
    </div>
  );
}

function EditableAvailabilityRow({
  disabled,
  disabledDays,
  selectedSlots,
  slot,
  slotIndex,
  toggleSlot,
  weekStart,
}: {
  disabled: boolean;
  disabledDays: Set<number>;
  selectedSlots: Set<string>;
  slot: AvailabilityTimeSlot;
  slotIndex: number;
  toggleSlot: (dayOfWeek: number, startTime: string) => void;
  weekStart: string;
}) {
  return (
    <>
      <span className={slot.isHour ? "availability-time-label" : "availability-time-label muted"}>
        {slot.isHour ? slot.label : ""}
      </span>
      {availabilityDays.map((day) => {
        const key = getAvailabilitySlotKey(day.value, slot.value);
        const dayDisabled = disabledDays.has(day.value);
        const selected = !dayDisabled && selectedSlots.has(key);
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
          dayDisabled ? "is-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            aria-label={`${day.label} ${formatAvailabilityDate(addCalendarDays(weekStart, day.value))} ${slot.label}`}
            aria-pressed={selected}
            className={classNames}
            data-availability-key={key}
            disabled={disabled || dayDisabled}
            key={day.value}
            onPointerUp={(event) => {
              // Scrolling cancels touch pointers; only a completed tap toggles.
              if (event.pointerType === "touch" && !disabled && !dayDisabled) {
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
    timeZone: "UTC",
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
  weekStart,
}: {
  creatorId: string;
  initialRules: EditableAvailabilityRule[];
  selectedSlots: Set<string>;
  timezone: string;
  weekStart: string;
}) {
  const formData = new FormData();
  const firstRule = initialRules.find((rule) => rule.enabled !== false);

  formData.set("creatorId", creatorId);
  formData.set("timezone", timezone);
  if (weekStart === "default") formData.set("scope", "default");
  else formData.set("weekStart", weekStart);
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
      maxLength={ariaLabel === "Public profile intro" ? 180 : ariaLabel.includes("topic") || ariaLabel === "What people can ask" ? 100 : 4000}
      className={`editable-profile-field ${className}`}
      placeholder={ariaLabel}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
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

function formatAvailabilityDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatAvailabilityWeek(weekStart: string) {
  return `${formatAvailabilityDate(weekStart)} - ${formatAvailabilityDate(addCalendarDays(weekStart, 6))}`;
}

function getAvailabilityWeekOptions(today: string, end: string) {
  const options: string[] = [];
  let cursor = availabilityWeekStart(today);
  const lastWeek = availabilityWeekStart(end);

  while (cursor <= lastWeek) {
    options.push(cursor);
    cursor = addCalendarDays(cursor, 7);
  }

  return options;
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

function isSupportedMediaFile(file: File) {
  return ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"].includes(file.type);
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

function takeUploadFile(input: HTMLInputElement) {
  const file = input.files?.[0];
  // Selecting the same file after a failed upload must fire change again.
  input.value = "";
  return file;
}

function getProfileSettingsFormData(profile: EditableProfileState) {
  const formData = new FormData();
  const gallerySources = profile.mediaItems
    .map((item) => item.source.trim())
    .filter(isUploadedGallerySource)
    .filter(Boolean)
    .join("\n");

  formData.set("sessionOfferings", JSON.stringify(profile.offerings ?? []));
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
    /^\/api\/creators\/media\/media_[a-f0-9]+(?:\?video=1)?$/.test(source) ||
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
