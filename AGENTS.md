<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep domain data multi-tenant with company-scoped RLS; roles remain in `user_roles` because client-visible roles are unsafe.
- Keep the application bilingual through the shared i18n provider because PT/EN must cover every workflow.
- Put authenticated application pages under the managed `_authenticated` layout because browser sessions are client-side.
- Keep privileged user administration in authenticated server functions with a server-side master-role check before admin access.
- Delete managed accounts through Auth soft deletion after disabling the retained profile, and protect master accounts; retained identities preserve historical references without keeping sign-in credentials.
- Resolve usernames only inside the password sign-in server function and return session tokens only after credential and active-profile validation; never expose username-to-email lookups.
- Protect profile access fields with a database trigger; only service-side user administration may change username, activation, company assignment, or the initial-password flag.
- Keep a single root auth-state subscriber and provide authenticated self-service password changes with current-password verification, separate from master password resets.
- Keep newly registered non-master profiles inactive until a master approves them, because authentication alone must not grant application access.
- Record the employee job title on each appointment because scheduling must preserve the occupational role used at that time.
- Persist editable employee details as appointment snapshots and generate unique codes in the database for every insert; history reads snapshots through existing company-scoped access so registry changes cannot rewrite prior appointments.
- Finalize appointment exams and current employee details together through the service-only database RPC after server-side tenant validation, so the latest successful save updates the registry without rewriting historical snapshots or applying failed appointment edits.
- Use the service-role-only save_clinic_for_user RPC with an omitted location ID for new clinics, because generated RPC types cannot express nullable required UUID arguments.
- Use the shared occupational-function field in employee and appointment forms so a single value keeps the job title and saved function ID in sync.
- Run bulk registration imports through master-checked server functions using the caller's RLS client; insert only and skip existing identifiers to protect current records and appointment history.
- Share the CNPJ registry lookup in a server-only helper so individual and bulk company registration use the same verification sources.
