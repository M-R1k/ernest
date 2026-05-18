import ErnestWidget from './index'
import { getTenantConfig, resolveTenantId } from './config/tenant'

export default function App() {
  const tenantId = resolveTenantId()
  const tenantConfig = getTenantConfig(tenantId)

  return (
    <div className={`h-dvh w-screen ${tenantConfig.appShellClassName} tenant-${tenantId} antialiased`}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:m-4 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:bg-gray-800"
      >
        Aller au contenu
      </a>

      <main id="contenu" className="flex h-full w-full flex-col">
        <div className={`${tenantConfig.cardClassName} h-full overflow-hidden`}>
          <ErnestWidget webhookUrl={tenantConfig.webhookUrl} />
        </div>
      </main>
    </div>
  )
}