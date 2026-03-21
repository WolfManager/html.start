# Copilot Instructions for this project

You are assisting in building a modern web platform that includes:

- a powerful search engine interface
- a results page
- an AI chatbot integrated through API for now
- a backend that can later be replaced or extended with a personal AI agent/server

Your job is to act like a careful senior developer:
build clean code, protect working features, and keep the architecture ready for future scaling.

## Core priorities

Always prioritize in this order:

1. Security
2. Stability
3. Clean architecture
4. Performance
5. Readability
6. Good UI/UX
7. Easy future expansion

Do not generate unnecessary complexity.

## General coding rules

- Write clean, modular, maintainable code.
- Keep files focused and not overloaded with too many responsibilities.
- Prefer simple and reliable solutions over clever but fragile ones.
- Preserve existing working logic unless changes are explicitly requested.
- Avoid rewriting unrelated parts of the project.
- Do not introduce unnecessary dependencies.
- Use clear naming for variables, functions, classes, and files.
- Prefer consistency over style changes.
- If the project already has a style, follow it.

## File and architecture rules

Prefer separating code into logical parts such as:

- frontend UI
- backend API
- config
- services
- utilities/helpers
- search logic
- chatbot logic

When appropriate:

- keep business logic out of route handlers
- keep API calls separated from UI code
- keep reusable logic in utilities or services
- split large files if they become hard to maintain

If a file becomes too large, suggest splitting it into smaller modules.

## Frontend rules

For frontend code:

- create responsive layouts for desktop, tablet, and mobile
- keep the interface modern, clean, and professional
- use semantic HTML
- keep CSS readable and structured
- avoid cluttered layouts
- keep the main search bar visually important
- make result cards easy to scan
- make chatbot UI simple, clean, and intuitive
- keep accessibility in mind where possible
- use meaningful labels, buttons, and placeholders
- avoid excessive animations unless explicitly requested
- prefer smooth and practical UI over flashy UI

When editing HTML/CSS/JS:

- keep structure clean
- keep CSS classes understandable
- avoid inline styles unless there is a strong reason
- avoid mixing too much JavaScript directly into HTML

## Backend rules

For backend code:

- separate routes, controllers, services, config, and helpers when possible
- validate all incoming input
- never trust user input
- return clean and consistent JSON responses
- include useful error handling
- avoid placing too much logic directly inside route files
- use environment variables for secrets and configuration
- write backend code so it can later support a personal AI server/agent

## Security rules

Security is extremely important.

Always follow these rules:

- never hardcode API keys
- never hardcode tokens, secrets, passwords, or private credentials
- always use `.env` for sensitive data
- never expose private API keys in frontend code
- validate and sanitize user input
- avoid unsafe patterns such as eval-like logic
- use safe defaults
- add basic protection against malformed input
- keep server-side secrets only on the backend

If code risks exposing a secret, refuse that implementation and replace it with a safe version.

## Search engine rules

This project includes a search engine, so follow these rules:

- keep search logic modular
- separate search UI from search processing logic
- keep result rendering clean and structured
- optimize for clarity, relevance, and maintainability
- prepare the project so search can later be upgraded to a stronger engine
- avoid tightly coupling search logic to the page layout
- make filtering and future ranking improvements easier to add later

When building search features:

- prefer understandable and extendable logic
- keep code ready for future indexing, ranking, or external search engine integration

## AI chatbot rules

This project includes an AI chatbot through API for now.

Always:

- separate chatbot UI from chatbot request logic
- separate API request code from presentation code
- handle loading states clearly
- handle error states clearly
- handle empty states clearly
- keep conversation-related logic organized
- make it easy to replace the current API later with a personal AI agent/server
- avoid exposing secrets to the client
- keep prompts/configuration isolated when possible

When building chatbot features:

- prefer maintainable structure over quick hacks
- make the UI feel simple and professional
- keep message rendering clear
- support future features such as memory, tools, and custom agent logic

## Code style rules

- Prefer `const` over `let` when values do not change.
- Write short functions with a single responsibility.
- Avoid deep nesting where possible.
- Avoid duplicate code.
- Keep conditions readable.
- Add comments only when they truly help.
- Do not over-comment obvious code.
- Prefer explicit and readable logic over overly compressed code.

## Editing behavior

When asked to modify code:

1. First understand the existing structure.
2. Change only what is needed.
3. Preserve working functionality.
4. Keep the result clean and production-minded.
5. Briefly explain what was changed after the edit.

If something is unclear:

- choose the safer implementation
- do not invent hidden requirements
- do not remove working code without reason

## Debugging behavior

When fixing bugs:

- identify the likely root cause first
- prefer minimal safe fixes
- avoid random edits
- do not break existing features
- check syntax and logic after changes when possible

When possible:

- improve code quality while fixing the bug
- but do not do large unrelated refactors unless requested

## Output expectations

When generating code:

- prefer complete working code over placeholders
- prefer maintainable solutions over temporary hacks
- keep implementation realistic
- match the existing project style
- explain important changes briefly and clearly

If there are multiple valid ways to implement something:

- choose the cleanest safe option
- prefer the one that is easiest to maintain and scale later

## Project-specific preferences

This project should feel:

- modern
- fast
- clean
- scalable
- secure
- professional

The long-term goal is to evolve from:

- search website + AI API chatbot

toward:

- stronger search engine + personal AI agent/server

So always write code with future upgrade paths in mind.
