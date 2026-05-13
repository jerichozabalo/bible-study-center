# Bible Study Center

A Bible study ministry website — sharing God's Word through devotionals, studies, and community.

## Setup

This is a [Jekyll](https://jekyllrb.com/) site hosted on **GitHub Pages**.

### Local Development

1. Install Ruby and Bundler
2. Run `bundle install`
3. Run `bundle exec jekyll serve`
4. Open `http://localhost:4000/bible-study-center/`

### Deployment

Push to the `main` branch of `jerichozabalo/bible-study-center` on GitHub.
GitHub Pages will build and deploy automatically.

## Adding Blog Posts

Create a new file in `_posts/` with the format:
```
2026-06-01-your-title-here.md
```

Include front matter:
```yaml
---
title: Your Post Title
author: Bible Study Center
---
```

Then write your content in Markdown.

## Pages

- **Home** — `index.html`
- **About** — `about.md`
- **Blog** — `blog.md`
- **Donate** — `donate.md`
- **Contact** — `contact.md`
