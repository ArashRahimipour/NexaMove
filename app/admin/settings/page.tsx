import { getAppSettings } from "@/lib/settings";
import { AppSettingsForm } from "@/components/AppSettingsForm";

export default async function SettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AppSettingsForm settings={settings} />
      <div className="card">
        <h3 className="font-semibold">Integrations</h3>
        <p className="mt-1 text-sm text-dim">
          SMS, email, and Google Maps are not yet connected — these require API keys/accounts that only an
          administrator with billing access can create. See <code>docs/DEPLOYMENT.md</code> for setup instructions.
          Nothing here is faked: notifications and map features stay off until real credentials are configured.
        </p>
      </div>
    </div>
  );
}
