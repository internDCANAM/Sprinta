# API Intent

## Systems of record

*Who is entitled to state each fact.*

| Data                              |         System of record          |
|-----------------------------------|:---------------------------------:|
| Deal existence, terms, and status |    forestry operations system     |
| Timeline events                   |    forestry operations system     |
| Harvest and haulage costs         |    forestry operations system     |
| Agreed prices                     |        the signed contract        |
| Property identity, boundary, area |           Lantmäteriet            |
| Ownership and shares              |           Lantmäteriet            |
| Measured volume per assortment    | Biometria / the measuring station |
| Felling notification status       |          Skogsstyrelsen           |
| Settlement amount                 |          finance system           |
| Payout bank account               |          finance system           |
| Payment cleared                   |       the bank, via finance       |
| Contract and settlement PDFs      |    forestry operations system     |
| Owner contact details             |           **THIS APP**            |
| Portal messages                   |           **THIS APP**            |
| Portal login and session          |           **THIS APP**            |
| Bank-account change requests      |           **THIS APP**            |
| Property-link requests            |           **THIS APP**            |

Five rows are ours. The rest arrive, many from outside the company altogether -
volume is Biometria's, not the buyer's. boundaries are Lantmäteriet's. a felling
notification is accepted or refused by Skogsstyrelsen. money has moved when the
bank says it has.

### How they reach us

Who is authoritative says nothing about how the data crosses.

| Source              | What we get                 | How                  |
|---------------------|-----------------------------|----------------------|
| Biometria (VIOL 3)  | measured volume, mätbesked  | papiNet XML, cert    |
| Lantmäteriet        | boundary and area           | REST/WFS, open CC0   |
| Lantmäteriet        | ownership and shares        | register, licensed   |
| Skogsstyrelsen      | felling notification status | Nemus API, XML + WKT |
| Harvester           | per-tree production         | StanForD 2010 `.hpr` |
| forestry ops system | deal, terms, status, events | ask the company      |
| finance system      | settlement, payout, cleared | ask the company      |

Four of these change what we build.

- **[Biometria][bio]** issues an integration certificate against a signed
  integration contract and standardises on papiNet. Mätbesked arrive as XML over
  a certificate.
- **[Lantmäteriet][lm] splits in two.** Geometry is open data. Ownership - name
  and personnummer or orgnr - sits in fastighetsregistret behind a licence
  agreement. The row this app leans on hardest is the gated one.
- **[Skogsstyrelsen][sks] is outbound.** Nemus is where an avverkningsanmälan
  gets submitted. This app never submits one, the operations system does. We
  reflect the status and nothing else.
- **The last two rows are the company's to name.** Not placeholders - the roles
  are real, because something has to record that a deal exists and something has
  to move money. Only the product is unknown, and nobody outside the company can
  state it. If the answer comes back "we have neither", that is not a missing
  integration, it is a different architecture and this document changes.

## Our rows

- **Contact details** - portal-owned outright. Phone, address.
- **Bank account - a change request, not a write.**  
  The owner submits and the company verifies. The effective value returns as
  reflected, masked data. The portal shows the current reflected value alongside
  any pending request. Because repointing a payout is a known fraud vector, and
  no company would let a portal do it silently. And the paying system pays from
  its own record, so a write changes nothing.
- **Message to the company** - portal-owned in both directions.
- **Property-link request** - checked against reflected ownership.
- **Account claim.**  
  Registration option must go - You do not become a customer by registering, you
  are a customer first. See [Accounts](#accounts).

## Accounts

An account is only **claimed** not created.

1. Ingestion brings the owner in as a reflected party - they are already a
   counterparty on a deal upstream. Name, identity number, contact.
2. The owner authenticates with **[BankID][bid]**. The completion data carries
   their personnummer.
3. The app matches it against reflected parties. Match - a session scoped to
   that party's stake. No match - nothing.

Created by ingestion, from the operations system's counterparty record, handed
out by no one.

Costs:

- **We must hold the identity number to match on.** Store a hash, compare
  hashes, never return it. Most sensitive field in the app, and it exists only
  to answer "which reflected party is this".
- **BankID needs a relying-party certificate**, bought through a bank together
  with the BankID service. An agreement, not an afternoon.

Until there is a BankID agreement: a desk-issued one-time token to the reflected
contact address. Same shape - the party must already exist upstream, the token
only proves control of an address we were handed. Not registration.

## Data flow

Reflected data arrives through one path, authed by a **service principal**,
also called a **named machine account**: a login that belongs to a system rather
than a person. It has a name so you can tell which system used it, a credential
instead of a password, and no way to reset that credential by email. Nobody
signs into it. It exists so that when a row appears you can say which
integration put it there, and so you can switch one integration off without
touching the others.

- **One credential per source**, matching the table above. The credential
  decides the `source` half of `(source, externalRef)` - a caller cannot claim
  to be a different upstream.
- **Transport follows the upstream.** Biometria issues certificates, so that one
  is mTLS. A system we control can use a bearer token.
- **Its own router**, own rate limit, own audit trail.
- **Rotation and revocation per source**, so one compromised integration does
  not cost the others.

The current admin route is wrong in four separate ways:

- **Actor.** A browser session carrying a flag, where it should be a service
  principal.
- **Verb.** "create", where it should be reconcile-or-update, idempotent on
  re-run.
- **Object.** One flat "transaction" row, where it should be a contract and its
  facts arriving together.
- **Credential.** A user JWT, where it should be a service credential on a route
  tree of its own.

**What a reflected record carries: `(source, externalRef)`.** `externalId`
assumes there will only ever be one upstream system.
[Systems of record](#systems-of-record) above names seven distinct authorities.

Reflected rows are append-or-replace from ingestion and immutable to everything
else. There is no route through which a browser session writes a reflected
field.

**Open - blocks everything below.** Test mocks and a demo API for incoming data:
the shape of an ingestion payload, which fields it carries, and how those land
in the database.

## Two parties

Admin logic and definitions should be removed. What should remain is smaller and
different in kind: a **support** or **desk** - The counter where messages get
answered and papers are handed over.

> A desk operator may **write** only portal-owned data, and may **read** only
> records addressed to the desk - a message thread, and the deal that thread
> sits on.

**This means...**  
creating a deal, changing status, entering volume, recording a payment, listing
every owner, reading anyone's bank details - is either: reflected data or
outside support's scope.

- **People in reflected data are contacts, not accounts.**  
  The buyer who signed the contract, the person who logged an event upstream,
  the uploader of a reflected document - none of them has a login here.

- **`Deal.assignedToId` becomes a reflected contact.**  
  "Who is my buyer and how do I reach them" is one of the things an owner
  actually opens the portal for.

- **A support / desk operator is a separate party...**  
  With its own credential and its own route tree.

## Ownership and access

- **Access derives from the link.**  
  You see a deal because you hold a stake in the property it sits on, for the
  period in question. Revocation when a share is sold or inherited falls out of
  the model.

- **Payout splitting across co-owners becomes expressible.**  
  Enabled, not built.

- **Claiming land is a request to be linked**  
  Checked against reflected ownership. Never a self-service grant - a cadastral
  id is not a secret, and anyone can type one in.

## Definite changes

### Removed

| What                                    | Where                           |
|-----------------------------------------|---------------------------------|
| `POST /auth/register`                   | [`routes/auth.ts`][r-auth]      |
| `/admin/*`                              | [`routes/admin.ts`][r-adm]      |
| `adminMiddleware`                       | [`middleware/auth.ts`][mw]      |
| `isAdmin` flag                          | four files, listed below        |
| `AdminDealRow`, `createDealInputSchema` | [`dto/deal.ts`][d-deal]         |
| `AdminUserRow`                          | [`dto/user.ts`][d-user]         |
| admin fetchers                          | [`api/endpoints.ts`][ep]        |
| `AdminPage`                             | [`pages/AdminPage.tsx`][ap]     |
| `adminOnly` branch                      | [`auth/ProtectedRoute.tsx`][pr] |

`isAdmin` spans [`schema.prisma`][sch], [`dto/user.ts`][d-user],
[`utils/auth.ts`][u-auth] (access token payload) and [`routes/auth.ts`][r-auth]
(login and refresh responses).

### Added

#### support / desk
AdminPage become this, rewritten.

#### ingestion path
- measured volume
- area of land
- ownership & shares
- felling notification
- per-tree production
- deal, terms, status, events
- settlement, payout, cleared
- contract and settlement PDFs

## Decide Also

- Document storage and serving - where files live, how access is granted
- Outbound message transport - email, shared inbox, or portal-only

[r-auth]: ../backend/src/routes/auth.ts
[r-adm]: ../backend/src/routes/admin.ts
[mw]: ../backend/src/middleware/auth.ts
[bio]: https://www.biometria.se/viol-3/integrationer/
[lm]: https://www.lantmateriet.se/sv/geodata/vara-produkter/Produktnyheter/Fastighetsinformation/
[sks]: https://www.skogsstyrelsen.se/e-tjanster-och-kartor/nemus-api/
[bid]: https://developers.bankid.com
[sch]: ../backend/prisma/schema.prisma
[d-deal]: ../backend/src/dto/deal.ts
[d-user]: ../backend/src/dto/user.ts
[u-auth]: ../backend/src/utils/auth.ts
[ep]: ../frontend/src/api/endpoints.ts
[ap]: ../frontend/src/pages/AdminPage.tsx
[pr]: ../frontend/src/auth/ProtectedRoute.tsx
