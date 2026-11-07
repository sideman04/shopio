import { Clock3, FileText, ShieldCheck } from 'lucide-react'
import { Alert, Button, Card, CardBody } from '@/components/ui'
import type { Seller } from '@/types'

export default function SellerApplicationPendingPage({ seller }: { seller: Seller | null }) {
  const rejected = seller?.verificationStatus === 'rejected'

  return (
    <div className="container-page py-12 sm:py-20">
      <Card className="mx-auto max-w-2xl">
        <CardBody className="space-y-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-gold-700">
            {rejected ? <FileText className="h-7 w-7" aria-hidden="true" /> : <Clock3 className="h-7 w-7" aria-hidden="true" />}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {rejected ? 'Update your seller application' : 'Seller application submitted'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              {rejected
                ? 'Your application needs an update before it can be approved. Review the notes and upload corrected documents in Seller settings.'
                : `Thanks${seller?.storeName ? ` for applying with ${seller.storeName}` : ''}. Our team is reviewing your application. You will be able to use the seller dashboard after approval.`}
            </p>
          </div>
          <Alert tone={rejected ? 'warning' : 'info'} title={rejected ? 'Action required' : 'Please wait for approval'}>
            {rejected
              ? 'Update your information or documents, then wait for another review.'
              : 'Your account is still active as a customer while the seller application is being reviewed.'}
          </Alert>
          <div className="flex flex-wrap justify-center gap-3">
            <Button to="/seller/settings">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Review documents
            </Button>
            <Button to="/" variant="outline">Back to storefront</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
