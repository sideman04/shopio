import { Button } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { useCookieConsent } from '@/context/CookieConsentContext'
import { CookieCategoryToggle } from './CookieCategoryToggle'

const categories = [
  {
    key: 'necessary',
    title: 'Strictly necessary',
    description: 'Keeps sign-in sessions, your cart, checkout and essential security features working.',
  },
  {
    key: 'functional',
    title: 'Functional',
    description: 'Remembers choices such as language and shopping preferences to make visits more convenient.',
  },
  {
    key: 'analytics',
    title: 'Analytics',
    description: 'Helps us understand site usage and improve the speed and performance of Shopio.',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    description: 'Allows advertising personalisation and measurement of our marketing campaigns.',
  },
] as const

export function CookiePreferenceModal() {
  const {
    preferences,
    preferencesOpen,
    saveError,
    closePreferences,
    updatePreference,
    acceptAll,
    rejectOptional,
    savePreferences,
  } = useCookieConsent()

  return (
    <Modal
      open={preferencesOpen}
      onClose={closePreferences}
      title="Cookie preferences"
      description="Choose which optional cookies Shopio may use. You can change these choices at any time."
      size="lg"
      className="max-h-[92dvh]"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={rejectOptional} className="w-full sm:w-auto">
            Reject optional
          </Button>
          <Button variant="outline" onClick={savePreferences} className="w-full sm:w-auto">
            Save preferences
          </Button>
          <Button onClick={acceptAll} className="w-full sm:w-auto">
            Accept all
          </Button>
        </div>
      }
    >
      <div className="divide-y-0">
        {categories.map((category) => (
          <CookieCategoryToggle
            key={category.key}
            category={category.key}
            title={category.title}
            description={category.description}
            checked={preferences[category.key]}
            disabled={category.key === 'necessary'}
            onChange={(enabled) => {
              if (category.key !== 'necessary') updatePreference(category.key, enabled)
            }}
          />
        ))}
      </div>
      {saveError && (
        <p role="status" className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {saveError}
        </p>
      )}
    </Modal>
  )
}
