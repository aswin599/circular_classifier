# -*- coding: utf-8 -*-
# Content rewritten for the "Circular Classifier" team project (no internship,
# no Heal N Glow).  Keys are the ORIGINAL source positions (page, y); the
# renderer keeps every baseline and line count fixed so the unmodified images,
# tables and page geometry stay valid.
#
#   LINE_EDITS   {(page, y): "single-line replacement text"}
#   PARA_EDITS   {(page, first_y): "full paragraph text (re-wrapped to the
#                                  original number of lines)"}
#   TABLE_EDITS  {(page, row, col): "cell text"}

# ---------------------------------------------------------------- headings / TOC
LINE_EDITS = {
    # page 3 - internship letter page becomes a declaration page
    (3, 756.0): "Declaration",

    # page 6 - table of contents, module list
    (6, 510.4): "6.1 Authentication Module       15",
    (6, 486.3): "6.2 Dashboard Module       15",
    (6, 462.1): "6.3 Circulars Module       15",
    (6, 438.0): "6.4 Email & OCR Module       16",
    (6, 413.8): "6.5 Classification Module       16",
    (6, 389.7): "6.6 Expiry Alerts Module       16",
    (6, 365.5): "6.7 Search Module       16",
    (6, 341.4): "6.8 Admin Module       16",
    (6, 317.2): "6.9 Attachments Module       16",

    # page 10 - technology heading
    (10, 275.5): "Cloud Deployment (PaaS)",

    # page 15 - software specification headings
    (15, 608.8): "Styling – Tailwind CSS",
    (15, 517.4): "Backend Framework – Node.js and Express",
    (15, 243.4): "Database – MongoDB",

    # page 17 - methodology headings
    (17, 588.6): "1. Layered Client-Server Architecture",
    (17, 405.9): "3. Asynchronous Processing with Queues",

    # page 18 - advantages heading
    (18, 139.7): "6. Centralized Institutional Communication",

    # page 24-25 - module titles
    (24, 720.0): "6.1 Authentication Module",
    (24, 553.3): "6.2 Dashboard Module",
    (24, 369.4): "6.3 Circulars Module",
    (24, 219.9): "6.4 Email & OCR Module",
    (25, 757.9): "6.5 Classification Module",
    (25, 591.1): "6.6 Expiry Alerts Module",
    (25, 441.6): "6.7 Search Module",
    (25, 309.3): "6.8 Admin Module",
    (25, 176.9): "6.9 Attachments Module",

    # page 26-27 - result headings
    (26, 493.6): "2. Automated Circular Ingestion:",
    (26, 355.9): "3. Automatic Classification:",
    (26, 269.9): "4. Expiry and Priority Alerts:",
    (27, 757.9): "5. Instant Search and Filters:",

    # page 34-35 - conclusion headings
    (34, 418.0): "2. User Feedback and Iteration:",
    (35, 757.9): "4. Comprehensive Circular Repository:",
}

# ---------------------------------------------------------------- paragraphs
PARA_EDITS = {
    # ---- page 4 : acknowledgement (team voice, no internship)
    (4, 698.3): ("We wish to express our deep sense of gratitude to Dr. L.Ashok "
                 "Kumar, Principal of Thiagarajar College of Engineering for "
                 "his support and encouragement throughout this project work."),
    (4, 601.7): "We wish to express our sincere thanks to Dr.P.Chitra, Head of the",
    (4, 577.5): ("Department of Computer Applications for her support and ardent "
                 "guidance."),
    (4, 529.2): ("We owe our special thanks and gratitude to the faculty incharge "
                 "Dr.P.Chitra Professor, Department of Computer Applications for "
                 "her guidance and support throughout our project."),
    (4, 432.7): ("We are also indebted to all the teaching and non-teaching staff "
                 "members of our college for helping us directly or indirectly by "
                 "all means throughout the course of our study and project work."),
    (4, 336.1): ("We extremely thank our parents, family members and friends for "
                 "their moral support and encouragement for our project."),

    # ---- page 7 : abstract  (first-y key = whole logical paragraph; the
    #      indented first line and its continuation are merged by the builder)
    (7, 700.1): ("In today's fast-paced academic environment, higher education "
                 "institutions issue a large number of circulars, notices and "
                 "announcements every day covering examinations, placements, "
                 "academic schedules, holidays and administrative instructions. "
                 "These circulars are usually distributed through email groups, "
                 "notice boards and messaging applications, making important "
                 "information difficult to track, search and prioritise. As a "
                 "result, students and staff often miss critical deadlines. The "
                 "Circular Classifier has therefore been developed as a "
                 "centralized institutional circular management system that "
                 "automatically collects incoming circulars, extracts their text, "
                 "classifies them into meaningful categories, detects expiry dates "
                 "and organises everything by priority for easy retrieval."),
    (7, 484.4): ("The system has been designed and implemented as a full-stack web "
                 "application using React with Vite (TypeScript and Tailwind CSS) "
                 "for the front-end and Node.js with Express for the back-end. "
                 "Circulars are received from a mail server through IMAP, processed "
                 "by background workers built on Redis and Bull queues, and "
                 "analysed using Tesseract OCR together with PDF and DOCX text "
                 "extraction. A keyword classifier automatically assigns each "
                 "circular to a category such as Examinations, Academic, "
                 "Placements, Holidays, Events or Administration, while an "
                 "expiry-date detector highlights the circulars that are ending "
                 "soon. All records, categories, users and logs are stored in "
                 "MongoDB, and the application provides a dashboard, instant "
                 "keyword search with filters and an administrative console."),
    (7, 268.8): ("Deploying this system offers several advantages to the "
                 "institution. It removes the dependence on scattered email "
                 "threads and notice boards, ensures that every circular is "
                 "captured and archived in one place, and greatly reduces the "
                 "effort required to find an old notice. Priority-based sorting "
                 "and expiry alerts help students and staff act on time-critical "
                 "announcements, while the classification and search modules make "
                 "large volumes of information easy to navigate. The modular "
                 "architecture allows new categories and notification channels to "
                 "be added without disturbing existing modules. In the long term, "
                 "the system can be extended with mobile notifications, "
                 "multi-institution support and analytics dashboards."),

    # ---- page 10 : 1.1 introduction (technologies)
    (10, 666.0): ("The front-end of the Circular Classifier is built with React, a "
                  "JavaScript library developed by Meta for creating dynamic and "
                  "reusable user-interface components. Each part of the application, "
                  "such as the dashboard, the circular table, the search panel and "
                  "the admin console, is implemented as an independent, reusable "
                  "component. React's virtual DOM updates only the parts of a page "
                  "that change, keeping large circular listings fast and responsive, "
                  "and its declarative style makes the code predictable and easy to "
                  "debug while improving maintainability and scalability."),
    (10, 510.4): ("JavaScript, particularly the ES6 (ECMAScript 2015) version, is "
                  "used throughout the client to add interactivity and logical "
                  "control. Features such as arrow functions, template literals, "
                  "promises and modular imports keep the code concise and "
                  "maintainable. JavaScript handles user events, asynchronous API "
                  "calls, live search and the dynamic rendering of circular data, "
                  "ensuring that the interface responds instantly to user actions."),
    (10, 370.7): ("GitHub is used for version control and collaborative development. "
                  "The team stored the source code in GitHub repositories, created "
                  "branches for individual features and tracked every change through "
                  "commits and pull requests. This produced a clear version history, "
                  "minimised conflicts between the two developers and allowed "
                  "features to be integrated smoothly throughout the project."),
    (10, 246.8): ("The application is deployed on a cloud Platform-as-a-Service "
                  "environment so that it remains accessible to all users without "
                  "dedicated institutional servers. Continuous deployment from the "
                  "GitHub repository keeps the live build up to date, and a global "
                  "content-delivery network reduces latency for users. The same "
                  "deployment pipeline serves the Node.js API and the static client "
                  "build, providing a simple and reliable hosting setup."),

    # ---- page 11 : 1.2 organisation profile (the institution)
    (11, 733.0): ("Thiagarajar College of Engineering (TCE), Madurai, established "
                  "in 1957, is a government-aided autonomous institution affiliated "
                  "to Anna University, Chennai. It is one of the most reputed "
                  "engineering colleges in Tamil Nadu, offering undergraduate, "
                  "postgraduate and doctoral programmes in engineering, technology, "
                  "architecture and computer applications, and is accredited by the "
                  "National Assessment and Accreditation Council (NAAC)."),
    (11, 609.9): ("The Department of Computer Applications offers the Master of "
                  "Computer Applications (MCA) programme and focuses on software "
                  "engineering, web technologies, databases and emerging areas such "
                  "as data science and cloud computing. The department provides "
                  "well-equipped laboratories, high-speed internet and a "
                  "project-oriented curriculum that encourages students to build "
                  "complete, deployable software systems under the guidance of "
                  "experienced faculty."),
    (11, 486.8): ("The vision of the department is to produce competent and socially "
                  "responsible computer professionals who can design and deliver "
                  "innovative software solutions. Its mission is to impart quality "
                  "technical education, promote research and teamwork, and nurture "
                  "ethical values. These objectives guided the development of the "
                  "Circular Classifier as a practical, socially useful project that "
                  "addresses a genuine communication problem faced by institutions."),
    (11, 379.6): ("The strengths of the department lie in its experienced faculty, "
                  "well-structured curriculum and active project culture. Students "
                  "are encouraged to work in teams, adopt modern development tools "
                  "and follow standard software processes, which closely matches the "
                  "way the Circular Classifier project was planned, executed and "
                  "documented by the team."),
    (11, 288.3): ("In line with the department's emphasis on full-stack and "
                  "cloud-ready skills, the project uses a modern technology stack "
                  "that includes React with Vite and TypeScript, Node.js with "
                  "Express, MongoDB, Redis and Bull background workers, Tesseract "
                  "OCR and a keyword-based classifier. The institution actively "
                  "promotes such end-to-end projects, as they prepare students for "
                  "real-world software development and provide useful tools for the "
                  "campus community. With its strong academic foundation, technical "
                  "infrastructure and supportive mentoring, the department provided "
                  "an ideal environment in which the Circular Classifier was "
                  "designed, implemented and evaluated."),

    # ---- page 13 : problem description
    (13, 707.7): ("Educational institutions publish a constant stream of circulars "
                  "covering examinations, results, placements, fee deadlines, "
                  "holidays and administrative instructions. In most institutions "
                  "these circulars are shared through email groups, printed notice "
                  "boards or messaging applications, and there is no single place "
                  "where they are stored or searched. Important announcements get "
                  "buried under newer messages, duplicate copies circulate in "
                  "different groups, and students frequently miss deadlines. "
                  "Tracking which circulars are still valid, which are urgent and "
                  "which relate to a particular department is extremely difficult."),
    (13, 585.3): ("The absence of a centralized platform also creates extra work for "
                  "the administrative staff, who must resend the same information "
                  "repeatedly and answer the same queries. Hence there is a clear "
                  "need for a professional, searchable and priority-aware circular "
                  "management system that can serve as a single source of truth for "
                  "every institutional announcement."),
    (13, 472.5): ("\u25cf To design and develop a centralized web application that "
                  "collects institutional circulars from email and file sources "
                  "automatically."),
    (13, 431.0): ("\u25cf To extract text from PDF, DOCX and image attachments using "
                  "Tesseract OCR and document-parsing libraries."),
    (13, 389.6): ("\u25cf To classify circulars into categories with a keyword-based "
                  "classifier and to assign priority levels automatically."),
    (13, 348.1): ("\u25cf To detect expiry dates and highlight circulars that are "
                  "ending soon through dashboards and alerts."),
    (13, 306.7): ("\u25cf To provide instant keyword search with category, priority "
                  "and date filters."),
    (13, 279.0): ("\u25cf To build an administrative console for managing categories, "
                  "keywords and user accounts, and to use GitHub for collaboration "
                  "and version control."),

    # ---- page 14 : scope and functional requirements
    (14, 692.3): ("This project focuses on developing a centralized circular "
                  "management system for educational institutions. It collects "
                  "circulars from a mail server and from uploaded documents, "
                  "processes them automatically, classifies them by category and "
                  "presents them through a searchable, priority-aware web "
                  "interface."),
    (14, 625.1): ("The scope covers the complete workflow of circular handling: "
                  "ingestion, text extraction, classification, expiry detection, "
                  "storage, search and administration. It is designed for "
                  "institutional use but can be adapted to any organization that "
                  "distributes large volumes of notices."),
    (14, 557.9): ("The system is built as a full-stack web application, with a React "
                  "(Vite, TypeScript and Tailwind CSS) client, a Node.js and "
                  "Express REST API, MongoDB for storage, and Redis with Bull for "
                  "background jobs. Tesseract OCR, PDF and DOCX parsers are used "
                  "for text extraction. It is version-controlled with GitHub and "
                  "deployed as a Node.js service for reliable, always-available "
                  "access."),
    (14, 422.1): ("\u25cf The system should automatically fetch incoming circulars "
                  "from the configured mail server and also support manual document "
                  "upload."),
    (14, 380.7): ("\u25cf It should extract text from email bodies and from PDF, DOCX "
                  "and image attachments, including scanned documents through OCR."),
    (14, 339.2): ("\u25cf It should classify each circular into a category using "
                  "configurable keywords and assign an appropriate priority."),
    (14, 297.8): ("\u25cf It should detect expiry dates and clearly indicate "
                  "circulars that are expiring today or soon."),
    (14, 256.3): ("\u25cf It should provide instant keyword search with filters for "
                  "category, priority, tag, sender and date range."),
    (14, 214.9): ("\u25cf It should present circulars on a dashboard sorted by date "
                  "and priority, with a detailed circular view."),
    (14, 173.4): ("\u25cf It should provide an admin console to manage categories, "
                  "keywords and user accounts, and must remain responsive across "
                  "devices."),

    # ---- page 15 : software specification bodies
    (15, 716.0): ("The client of the Circular Classifier is built using React, a "
                  "JavaScript library for building interactive, component-based "
                  "user interfaces. Each major part of the application, such as the "
                  "dashboard, the circular table, the search panel and the admin "
                  "console, is implemented as a reusable component. This modular "
                  "approach keeps the interface consistent, simplifies maintenance "
                  "and allows new screens to be added easily, while React's virtual "
                  "DOM keeps large circular listings fast and responsive."),
    (15, 592.9): ("The interface is styled using Tailwind CSS, a utility-first CSS "
                  "framework that provides precise control over layout, typography, "
                  "spacing and colour. Tailwind keeps the look and feel consistent "
                  "across every screen and device, and its responsive utilities make "
                  "the dashboard, tables and forms adapt cleanly to desktops, "
                  "tablets and mobile phones."),
    (15, 501.6): ("The back-end is built with Node.js and the Express framework. "
                  "It exposes a REST API for authentication, circulars, "
                  "categories, search and user management. Redis and Bull queues "
                  "process heavy jobs such as extraction, classification and "
                  "expiry detection asynchronously, keeping the interface "
                  "responsive."),
    (15, 410.2): ("The project is developed in Visual Studio Code, a lightweight and "
                  "feature-rich IDE that supports debugging, extensions, integrated "
                  "terminals and version control. VS Code provides a flexible "
                  "environment for writing React components and Node.js modules, "
                  "managing project files and testing both the client and the "
                  "server efficiently."),
    (15, 318.9): ("Git is used to track code changes, while GitHub enables "
                  "collaborative development by allowing both team members to work "
                  "on different features simultaneously. It ensures a structured "
                  "workflow with version history, branch management and pull "
                  "requests, making teamwork efficient and reducing code conflicts."),
    (15, 227.5): ("All application data, including circulars, users, categories and "
                  "processing logs, is stored in MongoDB, a document-oriented NoSQL "
                  "database. MongoDB's flexible schema suits circular data, which "
                  "varies in structure and attachments, and the Mongoose ODM "
                  "provides clear models, validation and efficient queries for "
                  "search and filtering."),

    # ---- page 16 : hardware specification bodies
    (16, 713.7): ("For development purposes, a system with an Intel i3 processor or "
                  "higher, 4 GB RAM (8 GB recommended) and at least 20 GB of free "
                  "storage is sufficient. This configuration supports running "
                  "Visual Studio Code, the Node.js server, MongoDB, Redis and a "
                  "browser simultaneously. A display with 1366 \u00d7 768 resolution "
                  "or higher allows efficient testing of the dashboard and "
                  "responsive layouts."),
    (16, 606.5): ("The application is deployed on a cloud Node.js hosting "
                  "environment with a managed MongoDB database and a Redis instance "
                  "for background queues. The platform automatically manages server "
                  "resources and scaling, ensuring that circulars are processed "
                  "reliably and the service stays accessible with low latency."),
    (16, 515.2): ("The application is optimized for a wide range of devices. Users "
                  "can access it seamlessly from desktops, laptops, tablets and "
                  "mobile phones, and the responsive design adapts to various "
                  "screen sizes and resolutions. Administrative users who upload or "
                  "manage circulars use the same interface, and only an internet "
                  "connection and a modern browser are required."),

    # ---- page 17 : methodology bodies
    (17, 695.8): ("The proposed system is a full-stack, service-oriented web "
                  "application for managing institutional circulars, with a strong "
                  "emphasis on automation, modular design and usability. The "
                  "methodology combines a layered client-server architecture with "
                  "an Agile development process, enabling iterative progress, "
                  "continuous feedback and flexible enhancements. The approach is "
                  "described below by feature:"),
    (17, 572.7): ("The system is divided into a React client, an Express REST API, "
                  "background processors and a MongoDB data layer. Each layer has a "
                  "clear responsibility and communicates through well-defined "
                  "interfaces, so the client, server and workers can be developed, "
                  "tested and scaled independently while remaining easy to "
                  "maintain."),
    (17, 481.3): ("The interface is designed to work seamlessly across desktops, "
                  "laptops, tablets and mobile devices. Tailwind's responsive "
                  "utilities adapt the dashboard, tables and forms to different "
                  "screen sizes, ensuring a consistent and intuitive experience for "
                  "both staff and students on any device."),
    (17, 390.0): ("Background jobs are processed asynchronously using Redis and Bull "
                  "queues. When a circular arrives from the mail server or is "
                  "uploaded, a job is enqueued for text extraction, OCR, "
                  "classification and expiry detection. This keeps the API "
                  "responsive, allows long-running tasks to complete reliably and "
                  "makes the processing pipeline easy to extend with new steps."),
    (17, 282.8): ("The project follows Agile methodology, incorporating iterative "
                  "sprints to achieve steady progress. Sprint planning defined "
                  "tasks for ingestion, extraction, classification, search and the "
                  "admin console. Each sprint concluded with internal reviews and "
                  "testing, allowing early detection of errors, continuous "
                  "improvement and flexibility for design changes."),
    (17, 175.6): ("Wireframes and mock-ups were created during the early stages of "
                  "development to visualise the dashboard, circular table, search "
                  "and filter panels and admin screens. These prototypes were "
                  "validated against real circular data and user needs, ensuring "
                  "that the final interface was clear, consistent and aligned with "
                  "the project goals."),

    # ---- page 18 : methodology 6-7 and advantages
    (18, 742.9): ("Git and GitHub were used for version control and collaborative "
                  "development. This ensured organised code management, easy "
                  "rollback to previous versions when needed, and efficient "
                  "teamwork between the two developers who worked on different "
                  "modules."),
    (18, 667.5): ("The application is deployed on a cloud platform that serves the "
                  "static client build and runs the Node.js API with managed "
                  "MongoDB and Redis services. This ensures the system is highly "
                  "available, processes circulars reliably in the background and "
                  "can be accessed by users across different regions."),
    (18, 560.8): ("The proposed system provides several distinct advantages, both "
                  "from a technical and an institutional perspective:"),
    (18, 501.2): ("The layered architecture ensures that each module is independent "
                  "and reusable. This improves maintainability, reduces development "
                  "time for future enhancements, and simplifies debugging and "
                  "testing."),
    (18, 425.7): ("A responsive, searchable interface with priority sorting and "
                  "expiry alerts lets students and staff find the right circular "
                  "quickly, reducing missed deadlines and improving communication "
                  "across the institution."),
    (18, 350.2): ("Agile methodology allows continuous progress through sprints. "
                  "Iterative development enables early detection of issues, timely "
                  "feedback and the flexibility to implement changes without "
                  "affecting the entire project."),
    (18, 274.8): ("Using Git and GitHub for version control ensures organised "
                  "teamwork, minimises code conflicts and provides a historical "
                  "record of changes. This streamlines development in a "
                  "multi-developer environment."),
    (18, 199.3): ("Cloud deployment with managed services enables automatic builds, "
                  "background job processing and scalability without additional "
                  "server setup, allowing the system to handle an increasing number "
                  "of circulars as the institution grows."),
    (18, 123.8): ("The system becomes a single source of truth for institutional "
                  "announcements. It captures every circular, classifies it "
                  "automatically and makes it searchable by keyword, category, "
                  "priority and date, thereby strengthening communication between "
                  "the administration, faculty and students."),

    # ---- page 24 : modules 6.1 - 6.4
    (24, 702.8): ("The authentication and user module handles registration, secure "
                  "login and role-based access. Users register with their name, "
                  "email, department and account type (Student or Admin), and "
                  "credentials are protected using hashed passwords and JSON Web "
                  "Tokens. The module maintains user profiles and permissions, "
                  "ensuring that administrative functions such as managing "
                  "categories and users are available only to authorised accounts, "
                  "while students and staff can view and search circulars."),
    (24, 536.1): ("The dashboard, presented as the Circular Hub, is the landing "
                  "screen after login. It lists institutional circulars sorted by "
                  "date and priority and provides quick access to categories, "
                  "users and search. A dedicated 'Ending Today' view highlights the "
                  "circulars whose deadline is the current day, and summary cards "
                  "show counts such as circulars ending today. Filters for sender, "
                  "category, priority and date range allow users to narrow the "
                  "list, making the dashboard a fast, at-a-glance overview of "
                  "everything that requires attention."),
    (24, 352.2): ("This module manages the complete life cycle of a circular, from "
                  "ingestion to display. Circulars received from the mail server or "
                  "uploaded manually are stored with their title, category, "
                  "priority, sender, tags, received date and due date. Users can "
                  "open a detailed view that shows the full content, attachment, "
                  "extracted important dates and the classification result, and "
                  "administrators can edit, archive or delete circulars, ensuring "
                  "that the repository always reflects the current state of "
                  "institutional communication."),
    (24, 202.7): ("This module fetches circulars automatically from the configured "
                  "institutional mail server using IMAP and also accepts manual "
                  "uploads of PDF, DOCX and image files. Email bodies are parsed, "
                  "and attachments are processed by PDF and DOCX text extractors. "
                  "Scanned documents and images are passed through the Tesseract "
                  "OCR engine to recover their text. Extracted content is "
                  "normalised and queued for classification and expiry detection, "
                  "so that even image-based notices become fully searchable."),

    # ---- page 25 : modules 6.5 - 6.9
    (25, 740.7): ("The keyword classification module assigns each circular to a "
                  "category automatically. Each category, such as Examinations, "
                  "Academic, Placements, Holidays, Events or Administration, is "
                  "defined with a set of keywords and phrases. When a circular is "
                  "processed, the module scores it against these keyword sets and "
                  "selects the best-matching category, storing the confidence and "
                  "the matched terms. Administrators can add or edit categories "
                  "and keywords from the admin console, so classification can be "
                  "tuned to the institution's own vocabulary without any code "
                  "changes."),
    (25, 574.0): ("The expiry date detection module scans the extracted text for "
                  "dates and deadline phrases and derives a due date for each "
                  "circular. It then computes the number of days remaining and "
                  "flags circulars that are expiring today or within a short "
                  "window. These flags drive the 'Ending Today' view and the "
                  "due-date column on the dashboard, helping users act on "
                  "time-critical announcements. Validity information is also shown "
                  "on the detailed circular view so that outdated notices are not "
                  "mistaken for current ones."),
    (25, 424.4): ("The search and filter module provides instant keyword search "
                  "across all circulars, with the option to filter by category, "
                  "priority, tag, sender and date range. Results are ranked and "
                  "displayed with their category, priority level and received date. "
                  "This module allows a user to locate a specific circular within "
                  "seconds even when the repository contains hundreds of notices, "
                  "combining full-text matching with structured filters for "
                  "accurate results."),
    (25, 292.1): ("The admin console gives administrators control over the system "
                  "configuration and users. It includes category management, where "
                  "categories and their keywords are created and edited, and user "
                  "management, where accounts are listed with their role, "
                  "department and join date. Changes made in the console "
                  "immediately affect how new circulars are classified, making the "
                  "console the operational heart of the system."),
    (25, 159.7): ("The attachment and storage module manages circular attachments. "
                  "Attachments such as PDF and image files are stored securely and "
                  "linked to their circulars, and all records including circulars, "
                  "users, categories and processing logs are persisted in MongoDB. "
                  "This module guarantees data integrity and provides the reliable "
                  "foundation on which search, display and administration depend."),

    # ---- page 26-28 : results and implementation
    (26, 694.8): ("The Circular Classifier project delivered a robust, automated "
                  "platform for managing institutional circulars. The results "
                  "achieved are as follows:"),
    (26, 596.8): ("\u25cb The dashboard presents circulars in a clean, sorted layout "
                  "that is easy to scan and navigate."),
    (26, 545.2): ("\u25cb Users can reach any circular, category or filter within a "
                  "few clicks, improving overall engagement."),
    (26, 459.2): "\u25cb Circulars are fetched automatically from the configured mail",
    (26, 442.0): "server and from uploaded documents and attachments.",
    (26, 407.5): ("\u25cb Circulars are classified into categories with keyword "
                  "matching and ranked by priority."),
    (26, 321.5): ("\u25cb Expiry detection flags circulars that are ending today or "
                  "soon."),
    (26, 235.5): ("\u25cb Priority levels help users focus on the most urgent notices "
                  "first."),
    (26, 183.8): ("\u25cb Automated processing removes the repeated manual effort of "
                  "sharing notices."),
    (27, 723.4): ("\u25cb A powerful search lets users find circulars by keyword, "
                  "category, priority, tag, sender or date."),
    (27, 671.8): ("\u25cb Results are ranked and displayed with their key details for "
                  "quick decisions."),
    (27, 585.8): ("\u25cb The application works well on desktops, tablets and mobile "
                  "devices."),
    (27, 551.3): ("\u25cb Ensures consistent performance and appearance across "
                  "different screen sizes."),
    (27, 465.3): ("\u25cb The application is deployed on a cloud platform with "
                  "managed database and queue services."),
    (27, 413.7): ("\u25cb Provides a secure, reliable and always-available service to "
                  "the institution."),
    (27, 350.1): "Overall Outcome: The project successfully achieved its objective of",
    (27, 332.9): "creating an automated, searchable and priority-aware system",
    (27, 315.7): "that improves how institutions communicate with students and staff.",
    (27, 257.3): ("The development of the Circular Classifier was completed in a "
                  "structured and systematic approach, as described below:"),
    (27, 176.5): "\u25cb Defined the scope, objectives and target users.",
    (27, 146.5): ("\u25cb Identified critical features: circular ingestion, "
                  "extraction, classification, expiry detection and search."),
    (27, 101.6): "\u25cb Prepared a timeline and allocated tasks to ensure timely completion.",
    (28, 723.4): ("\u25cb Designed the navigation structure and data model for "
                  "intuitive use."),
    (28, 689.0): ("\u25cb Planned the user interface and defined the categories and "
                  "priority rules."),
    (28, 603.0): ("\u25cb Implemented the client using React with a modular, "
                  "component-based architecture for maintainability and "
                  "scalability."),
    (28, 543.2): ("\u25cb Styled the interface with Tailwind CSS for a modern, "
                  "responsive layout."),
    (28, 498.4): ("\u25cb Built the Express REST API and background workers for "
                  "ingestion, OCR, classification and expiry detection."),
    (28, 453.5): ("\u25cb Stored circulars, users, categories and logs in MongoDB "
                  "using clear models."),
    (28, 408.7): ("\u25cb Optimized the application for performance and fast loading "
                  "across devices."),
    (28, 329.4): ("\u25cb Functional Testing: Verified ingestion, classification, "
                  "search and admin features."),
    (28, 277.8): ("\u25cb Design Testing: Checked layout consistency and "
                  "responsiveness across devices and browsers."),
    (28, 226.1): ("\u25cb Identified and resolved minor issues before deployment to "
                  "ensure smooth operation."),
    (28, 140.1): ("\u25cb Deployed the tested application on a cloud platform with "
                  "managed services."),
    (29, 757.8): ("\u25cb Configured the environment variables and mail-server "
                  "settings for the institution."),
    (29, 706.2): ("\u25cb Verified live performance, background processing and secure "
                  "access for users."),

    # ---- page 33 : implementation summary
    (33, 206.3): ("Implementation Summary: Through careful planning, systematic "
                  "design, rigorous testing and cloud deployment, the Circular "
                  "Classifier project successfully delivered a robust, reliable "
                  "and user-centric platform that meets the institution's "
                  "requirements and improves communication and engagement."),

    # ---- page 34-35 : conclusion
    (34, 712.0): ("The Circular Classifier project has been a successful endeavour "
                  "in delivering an automated, searchable and user-centric platform "
                  "for institutional circulars. The project achieved all its "
                  "primary objectives, providing both functional and practical "
                  "value to students, staff and administrators."),
    (34, 538.4): ("\u25cb The application was successfully deployed on a cloud "
                  "platform with managed database and queue services."),
    (34, 504.1): "professional and always-available service.",
    (34, 159.9): "announcements.",
    (34, 469.6): ("\u25cb Live deployment ensures that circulars are accessible to "
                  "users across the institution at any time."),
    (34, 383.6): ("\u25cb The system was well received by students and staff, who "
                  "continue to provide feedback for further improvements."),
    (34, 332.0): ("\u25cb Continuous feedback allows iterative updates, ensuring the "
                  "platform evolves according to user needs."),
    (34, 245.9): ("\u25cb The dashboard, instant search and filters make it easy to "
                  "find and track circulars."),
    (34, 194.3): ("\u25cb Users can explore circulars, categories and deadlines "
                  "seamlessly, improving awareness of important announcements."),
    (35, 723.4): ("\u25cb A centralized repository captures circulars from email and "
                  "uploads and classifies them automatically for easy retrieval."),
    (35, 654.6): ("\u25cb Search, filters and expiry alerts help users make informed "
                  "and timely decisions."),
    (35, 568.6): ("\u25cb The platform is fully responsive and optimized for "
                  "desktops, tablets and mobile devices."),
    (35, 516.9): ("\u25cb Accessibility features, such as clear labels and keyboard "
                  "navigation, ensure a wider reach and inclusivity."),
    (35, 430.9): ("\u25cb Using React, Node.js, MongoDB and Redis allowed for a "
                  "scalable and maintainable application."),
    (35, 379.3): ("\u25cb The modular architecture enables easy updates, new "
                  "categories and future scalability."),
    (35, 293.3): ("\u25cb The project underwent rigorous functional and design "
                  "testing, ensuring reliable performance and eliminating errors "
                  "before deployment."),
    (35, 195.3): ("Overall, the Circular Classifier project stands as a successful "
                  "implementation of modern full-stack development practices, "
                  "meeting institutional requirements and delivering a platform "
                  "that is functional, reliable, accessible and scalable. It not "
                  "only centralizes institutional communication but also provides a "
                  "strong base for continuous improvement, with user feedback "
                  "driving future enhancements."),

    # ---- page 36 : bibliography
    (36, 708.0): ("1. React Documentation \u2013 Official documentation for the "
                  "React library. https://react.dev"),
    (36, 656.3): ("2. Node.js and Express Documentation \u2013 Guides for building "
                  "REST APIs with Node.js and Express. https://nodejs.org/docs"),
    (36, 604.7): ("3. MDN Web Docs \u2013 HTML, CSS and JavaScript \u2013 Reference "
                  "for core web technologies. https://developer.mozilla.org"),
    (36, 535.9): ("4. MongoDB Documentation \u2013 Guides for data modelling and "
                  "queries with MongoDB and Mongoose. https://www.mongodb.com/docs"),
    (36, 467.0): ("5. Redis and Bull Documentation \u2013 For background job queues "
                  "and asynchronous processing. https://docs.bullmq.io"),
    (36, 415.4): ("6. Tesseract OCR Documentation \u2013 For extracting text from "
                  "images and scanned documents. https://tesseract-ocr.github.io"),
    (36, 363.8): ("7. Tailwind CSS Documentation \u2013 For utility-first styling and "
                  "responsive design. https://tailwindcss.com/docs"),
    (36, 318.8): ("8. Project Requirement Documents \u2013 Internal project "
                  "documentation prepared by the team for the Circular Classifier."),
}

# ---------------------------------------------------------------- page 12 table
TABLE_EDITS = {
    (12, 0, 0): "Module description",
    (12, 0, 1): "Existing manual method used",
    (12, 0, 2): "Drawbacks of the existing method",
    (12, 0, 3): "Features proposed to overcome",
    (12, 1, 0): "Distribution",
    (12, 1, 1): "Emails, notice boards and messaging groups",
    (12, 1, 2): ("Circulars are scattered across mails and easily "
                 "missed"),
    (12, 1, 3): ("Automatic ingestion from email and uploads into one "
                 "searchable and central repository"),
    (12, 2, 0): "Classification",
    (12, 2, 1): "Manual tagging or no labelling",
    (12, 2, 2): "Notices are hard to find by topic",
    (12, 2, 3): ("Keyword-based classifier assigns categories automatically"),
    (12, 3, 0): "Search",
    (12, 3, 1): "Scrolling through long mail threads",
    (12, 3, 2): "Old circulars are difficult to retrieve",
    (12, 3, 3): ("Instant keyword search with category, priority, tag and "
                 "date filters"),
    (12, 4, 0): "Priority & Expiry management",
    (12, 4, 1): "No concept of priority or deadlines",
    (12, 4, 2): ("Urgent notices and deadlines are missed, urgent mails "
                 "remain unnoticed, and priority is never reflected anywhere"),
    (12, 4, 3): ("Automatic priority levels and expiry-date alerts with "
                 "reminders for pending actions"),
    (12, 5, 0): "Dashboard",
    (12, 5, 1): "No single view of active circulars",
    (12, 5, 2): ("Users cannot see what needs attention or which "
                 "circulars are due soon"),
    (12, 5, 3): ("Dashboard sorted by date and priority with an 'Ending "
                 "Today' view"),
    (12, 6, 0): "Attachments",
    (12, 6, 1): ("Files attached to separate emails and scattered across "
                 "mail threads"),
    (12, 6, 2): "Attachments lose context and are hard to locate",
    (12, 6, 3): ("Attachments stored and linked to their circulars in "
                 "one place"),
    (12, 7, 0): "Users",
    (12, 7, 1): "Open mailing lists and chat groups",
    (12, 7, 2): ("No control over who publishes notices or edits them "
                 "after publishing, and no audit trail"),
    (12, 7, 3): ("Role-based accounts for students, staff and "
                 "administrators with per-role publish, edit and delete "
                 "rights"),
}
