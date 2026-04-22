export type PostAddressResource = {
  firstName?: string;
  lastName?: string;
  companyName?: string | null;
  street?: string;
  houseNo?: string;
  zipCode?: string;
  town?: string;
  countryCode?: string;
  type: 'CUSTOMER' | 'BILLING' | 'DELIVERY';
};

type PostPhoneResource = {
  type: 'PRIVATE' | 'BUSINESS' | 'MOBILE';
  phoneNumber: string;
};

type PostEmailResource = {
  type: 'PRIVATE' | 'BUSINESS';
  email: string;
};

export type PostCustomerResource = {
  firstName: string;
  lastName: string;
  companyName?: string | null;
  dateOfBirth?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  email?: string | null;
  emails?: PostEmailResource[];
  website?: string | null;
  phone?: string | null;
  phones?: PostPhoneResource[];
  membershipCard?: string | null;
  note?: string | null;
  ignoreForLoyalty?: boolean;
  addresses?: PostAddressResource[];
};

export type SignUpCustomerPayload = {
  hash: string;
  [key: string]: unknown;
};

type Headers = Record<string, string>;

/**
 * Posts a new customer sign-up via the POS HATEOAS API.
 * Discovers the `customerSignup` link from the service root, then POSTs the
 * resource. Mirrors the original CustomerSignUpService.post behavior.
 */
export async function postCustomerSignUp(
  posServiceUrl: string,
  resource: PostCustomerResource,
  headers: Headers,
): Promise<SignUpCustomerPayload> {
  const rootRes = await fetch(posServiceUrl, { headers });
  if (!rootRes.ok) {
    throw new Error(`POS discovery failed: ${rootRes.status} ${rootRes.statusText}`);
  }
  const root = (await rootRes.json()) as { _links: Record<string, { href: string }> };
  const href = root._links?.customerSignup?.href;
  if (!href) throw new Error('POS discovery: customerSignup link missing');

  const postRes = await fetch(href, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(resource),
  });
  if (!postRes.ok) {
    const text = await postRes.text().catch(() => '');
    throw new Error(`customerSignUp POST failed: ${postRes.status} ${postRes.statusText} ${text}`);
  }
  return (await postRes.json()) as SignUpCustomerPayload;
}
