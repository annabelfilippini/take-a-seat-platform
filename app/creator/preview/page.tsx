import { getSignedInCreatorEditorAccount } from "../../_lib/creator-dashboard";
import { createPublishedCreator, listCreatorAvailabilityRules } from "../../_lib/creator-onboarding";
import { CreatorProfileContent } from "../../with/[slug]/page";
export const dynamic = "force-dynamic";
export const metadata = {title:"Draft preview | Take a Seat",robots:{index:false,follow:false}};
export default async function CreatorPreviewPage() {
  const account = await getSignedInCreatorEditorAccount("/creator/preview");
  if (!account || !("profile" in account)) return <main><p>Sign in to preview your saved draft.</p></main>;
  const profile = account.profile;
  const draft = {...profile,...JSON.parse(profile.profileDraft || "{}")};
  const creator = createPublishedCreator(draft, await listCreatorAvailabilityRules(profile.id));
  return <CreatorProfileContent creator={creator} previewOnly />;
}
