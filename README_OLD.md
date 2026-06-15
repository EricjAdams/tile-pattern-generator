# Tile Pattern Generator

An interactive full-stack tile layout application that allows users to design, preview, save, and experiment with tile patterns in real time.

Originally developed as a frontend prototype, Tile Pattern Generator has evolved into a database-backed application featuring authentication, layout persistence, administrative tooling, automated testing, and continuous integration.

**Live Demo:** Private development build available upon request.

---

## Features

### Tile Design

- Click-to-place tile system
- Drag-to-paint multiple tiles
- Tile rotation support
- Dynamic wall dimension controls
- Adjustable zoom controls
- Responsive layout behavior
- Real-time tile preview rendering

### Tile Management

- Dynamic tile libraries
- Upload custom tile images
- Uploaded tile persistence
- Sample tile collections
- Empty-state support for new users

### Layout Persistence

- Save new layouts
- Update existing layouts
- Load saved layouts
- Search saved layouts
- Delete saved layouts
- Editable sample layouts and working copies

### Pattern Exploration

- Randomize Pattern functionality
- Undo Randomize support
- Randomization for new layouts
- Randomization for saved layouts
- Randomization for sample layouts

### Authentication & Security

- User registration
- User login and logout
- Session management
- Legacy account support
- Administrative role support
- Authorization middleware
- IDOR mitigation and ownership validation
- Role-based access controls

### Quality & Automation

- Vitest unit testing
- ESLint validation
- GitHub Actions continuous integration
- Benchmark testing
- Sample data scaling validation

---

## Tech Stack

### Frontend

- React (Vite)
- JavaScript
- CSS

### Backend

- Node.js
- Express

### Database

- MySQL

### Testing & Automation

- Vitest
- ESLint
- GitHub Actions

---

## Project Status

Tile Pattern Generator has evolved from a frontend proof of concept into a full-stack application featuring authentication, layout persistence, administrative functionality, automated testing, and continuous integration.

Current capabilities include:

- Authenticated user accounts
- Persistent saved layouts
- Sample users and sample projects
- Uploaded tile persistence
- Pattern randomization with undo support
- Administrative tooling
- Automated testing and CI validation

Current development is focused on refining the user experience, expanding visualization capabilities, and preparing the application for future production deployment.

---

## Future Enhancements

- Grout color visualization
- Pattern export system
- Material usage calculations
- Advanced layout templates
- Mobile-first refinements
- AR-assisted tile previews
- Cloud deployment
- Public demonstration environment

---

## Project Evolution

### Version 1 – Tile Preview Prototype

![Initial Prototype](./ProgressSnaps/v1-basic-preview.jpg)

Basic proof of concept used to establish the early layout structure and visual language of the application.

---

### Version 2 – Interactive Grid System

![Interactive Grid](./ProgressSnaps/v2-interactive-grid.jpg)

Expanded into an interactive grid system featuring tile placement, painting, rotation, uploads, and layout controls.

---

### Version 3 – Persistence & Workflow Improvements

![Previous UI](./ProgressSnaps/May3Progress.jpg)

Introduced project naming workflows, saved layouts, database integration, and a more complete editing experience.

---

### Version 4 – Full-Stack Application

![Latest UI](./ProgressSnaps/ProgramState51726.jpg)

Expanded into a complete authenticated application featuring user accounts, persistent layouts, responsive behavior, administrative functionality, enhanced tile management workflows, and database-backed design persistence.

---

## Author

Eric Adams

Developed as part of Olympic College's Software Development program and continuously expanded into a production-oriented portfolio application.
