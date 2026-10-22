/**
 * Static marketing and reference copy.
 *
 * This is presentation content (help copy, pick-lists, courier names), not
 * domain data. Live records — categories, products, orders, geography — are
 * always fetched from the API.
 */

/** Business categories offered when a seller describes their store. */
export const businessCategories = [
  'Furniture & Home',
  'Electronics & Appliances',
  'Fashion & Apparel',
  'Home Decor & Lighting',
  'Accessories & Lifestyle',
  'Other',
]

/** Couriers a seller can nominate when fulfilling an order. */
export const shippingCarriers = ['Shopio Express', 'Coastal Freight', 'Nationwide Couriers']

/** Help-centre copy shared by `/faq` and the seller onboarding page. */
export const generalFaqs = [
  {
    question: 'How long does delivery take?',
    answer:
      'Most orders are delivered within 2–5 working days in Dar es Salaam and 3–7 working days elsewhere in Tanzania. Delivery estimates are shown at checkout before you pay.',
  },
  {
    question: 'What payment methods are accepted?',
    answer:
      'Shopio supports mobile money (M-Pesa, Tigo Pesa, Airtel Money), major debit and credit cards, and bank transfer. Available methods are confirmed by the payment provider at checkout.',
  },
  {
    question: 'Can I return an item?',
    answer:
      'Yes. Items can be returned within 7 days of delivery if they are unused and in their original packaging. Some categories, such as personal care items, are excluded.',
  },
  {
    question: 'How do I track my order?',
    answer:
      'Open your account, go to Orders, and select the order to see its live status timeline and courier details once dispatched.',
  },
  {
    question: 'Is my personal information secure?',
    answer:
      'Account data is handled in line with our privacy policy. Sessions are cookie-based and passwords are never stored in the browser.',
  },
  {
    question: 'How do I become a seller?',
    answer:
      'Start from the Sell Now link in the header. You will create a seller account, describe your store, and submit your business details for verification.',
  },
]

export const sellerFaqs = [
  {
    question: 'What does it cost to sell on Shopio?',
    answer:
      'Creating a store is free. Shopio takes a commission on each completed sale — typically 8–12% depending on category — which is deducted automatically at settlement.',
  },
  {
    question: 'How and when do I get paid?',
    answer:
      'Earnings become available after the buyer’s return window closes. You can request a payout to a bank account or mobile money wallet from the Payouts page.',
  },
  {
    question: 'What documents do I need to register?',
    answer:
      'You need your store details, a valid phone number, and a bank or mobile money account in the store’s name. Our verification team may ask for your national ID or business registration before your first payout.',
  },
  {
    question: 'Who handles delivery?',
    answer:
      'You can use Shopio Express or your own courier. If you ship yourself, mark the order as shipped and add the tracking number.',
  },
  {
    question: 'How do I get verified?',
    answer:
      'Submit your store application. Our team reviews most applications within two business days and contacts you if any documents are needed.',
  },
]
