## Soma Capital Technical Assessment

This is a technical assessment as part of the interview process for Soma Capital.

> [!IMPORTANT]  
> You will need a Pexels API key to complete the technical assessment portion of the application. You can sign up for a free API key at https://www.pexels.com/api/  

To begin, clone this repository to your local machine.

## Development

This is a [NextJS](https://nextjs.org) app, with a SQLite based backend, intended to be run with the LTS version of Node.

To run the development server:

```bash
npm i
npm run dev
```

## Task:

Modify the code to add support for due dates, image previews, and task dependencies.

### Part 1: Due Dates 

When a new task is created, users should be able to set a due date.

When showing the task list is shown, it must display the due date, and if the date is past the current time, the due date should be in red.

### Part 2: Image Generation 

When a todo is created, search for and display a relevant image to visualize the task to be done. 

To do this, make a request to the [Pexels API](https://www.pexels.com/api/) using the task description as a search query. Display the returned image to the user within the appropriate todo item. While the image is being loaded, indicate a loading state.

You will need to sign up for a free Pexels API key to make the fetch request. 

### Part 3: Task Dependencies

Implement a task dependency system that allows tasks to depend on other tasks. The system must:

1. Allow tasks to have multiple dependencies
2. Prevent circular dependencies
3. Show the critical path
4. Calculate the earliest possible start date for each task based on its dependencies
5. Visualize the dependency graph

## Submission:

1. Add a new "Solution" section to this README with a description and screenshot or recording of your solution. 
2. Push your changes to a public GitHub repository.
3. Submit a link to your repository in the application form.


### Solution:

- How it works:
  - Data model:
    - `Todo` includes `dueDate`, `imageUrl`, `durationDays` (estimated effort), and computed fields: `earliestStart`, `earliestFinish`, `latestStart`, `latestFinish`, `criticalPath`.
    - `TodoDependency` stores edges with cascade delete and a unique constraint per dependent/dependency pair.
  - Scheduling (weighted critical path):
    - Forward pass: ES = max(EF of predecessors); EF = ES + effort.
    - Backward pass: LF = min(LS of successors) or project end for sinks; LS = LF − effort.
    - Critical tasks have zero slack (LS − ES = 0). All computed values are anchored to “today” and stored as dates for display.
  - API routes:
    - `GET /api/todos` returns tasks with dependencies.
    - `POST /api/todos` creates a task, optionally with `dueDate` and `durationDays`, fetches a Pexels image, then recomputes the schedule.
    - `PATCH /api/todos/[id]` updates fields (title, due date, effort) and recomputes.
    - `DELETE /api/todos/[id]` deletes a task and recomputes.
    - `PUT /api/todos/[id]/dependencies` replaces dependency set, rejects cycles, recomputes.
    - `POST /api/todos/[id]/image` fetches and sets an image for an existing task.
  - Graph: Simple SVG layout by topological depth; nodes show Title, Earliest window, Effort, Due date (red if overdue), and critical highlighting.

- Running the demo quickly:
  - `npm install` and `npx prisma migrate dev` to sync the DB.
  - Load a realistic scenario: `npm run scenario:load -- scripts/scenarios/engineering_release.json`.
  - Start: `npm run dev` then open http://localhost:3000.

- Screenshots / recording at `docs/demo.mp4`

## Implementation Notes

- Database: Run `npx prisma migrate dev` to apply the dependency tables and computed fields. Scheduling fields (`earliestStart`, `earliestFinish`, `latestStart`, `latestFinish`, `criticalPath`) are recomputed automatically on task/dependency changes.

 - Estimated Effort and Critical Path: Each task has an estimated effort in days (`durationDays`, default 1). The scheduler computes a weighted critical path using efforts:
  - ES = max(EF of predecessors), EF = ES + duration
  - Project end = max(EF)
  - LF = min(LS of successors) or project end for sinks, LS = LF - duration
  - Critical tasks are those with zero slack (LS - ES = 0)



Thanks for your time and effort. We'll be in touch soon!
