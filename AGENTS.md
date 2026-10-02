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
