---
title: Contact Us
---

<section class="page-header">
  <div class="container">
    <h1>Contact Us</h1>
    <p>We'd love to hear from you</p>
  </div>
</section>

<section class="container contact-page">
  <div class="contact-grid">
    <div class="contact-info">
      <h2>Get in Touch</h2>

      <div class="contact-detail">
        <span class="contact-icon">📧</span>
        <div>
          <strong>Email</strong>
          <p>{{ site.email }}</p>
        </div>
      </div>

      <div class="contact-detail">
        <span class="contact-icon">📞</span>
        <div>
          <strong>Phone / Text</strong>
          <p>[Your Contact Number Here]</p>
        </div>
      </div>

      <div class="contact-detail">
        <span class="contact-icon">📍</span>
        <div>
          <strong>Location</strong>
          <p>Philippines</p>
        </div>
      </div>

      <div class="contact-detail">
        <span class="contact-icon">💬</span>
        <div>
          <strong>Social Media</strong>
          <p>Coming soon</p>
        </div>
      </div>
    </div>

    <div class="contact-form-wrapper">
      <h2>Send a Message</h2>
      <form id="contactForm" class="contact-form">
        <div class="form-group">
          <label for="contactName">Your Name *</label>
          <input type="text" id="contactName" name="name" required placeholder="e.g. Juan Dela Cruz">
        </div>
        <div class="form-group">
          <label for="contactEmail">Your Email *</label>
          <input type="email" id="contactEmail" name="email" required placeholder="you@email.com">
        </div>
        <div class="form-group">
          <label for="contactSubject">Subject</label>
          <input type="text" id="contactSubject" name="subject" placeholder="e.g. Bible Study Inquiry">
        </div>
        <div class="form-group">
          <label for="contactMessage">Message *</label>
          <textarea id="contactMessage" name="message" rows="5" required placeholder="Your message..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Send Message</button>
      </form>
      <div id="contactSuccess" class="success-message" style="display:none;">
        <p>✅ Thank you for your message! We'll get back to you as soon as possible. God bless! 🙏</p>
      </div>
    </div>
  </div>
</section>
