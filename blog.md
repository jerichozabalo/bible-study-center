---
title: Blog
---

<section class="page-header">
  <div class="container">
    <h1>Blog</h1>
    <p>Devotionals, studies, and reflections from the Word</p>
  </div>
</section>

<section class="container blog-list">
  {% if site.posts.size > 0 %}
    {% for post in site.posts %}
    <article class="blog-card">
      <div class="blog-card-body">
        <p class="blog-date">{{ post.date | date: "%B %d, %Y" }}</p>
        <h2><a href="{{ site.baseurl }}{{ post.url }}">{{ post.title }}</a></h2>
        <p class="blog-excerpt">{{ post.excerpt | strip_html | truncate: 200 }}</p>
        <a href="{{ site.baseurl }}{{ post.url }}" class="blog-read-more">Read More →</a>
      </div>
    </article>
    {% endfor %}
  {% else %}
    <div class="blog-empty">
      <p>No posts yet. Check back soon for Bible studies, devotionals, and reflections!</p>
    </div>
  {% endif %}
</section>
