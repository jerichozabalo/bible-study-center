---
title: Donate
---

<section class="page-header">
  <div class="container">
    <h1>Support the Ministry</h1>
    <p>Your generous giving makes this ministry possible</p>
  </div>
</section>

<section class="container donate-page">
  <div class="donate-intro">
    <p class="lead">Thank you for your willingness to support Bible Study Center. Your donations help us continue creating Bible study resources, reaching people with the Gospel, and serving our community.</p>
  </div>

  <div class="donation-options">
    <h2>How to Give</h2>

    <div class="payment-methods">

      <div class="payment-card">
        <div class="payment-header">
          <span class="payment-icon">📱</span>
          <h3>GCash</h3>
        </div>
        <div class="payment-body">
          <p>Send your donation via GCash:</p>
          <p class="payment-info">
            <strong>Name:</strong> [Your Name Here]<br>
            <strong>Number:</strong> [Your GCash Number Here]
          </p>
          <p class="payment-note">Scan QR or send directly. Please include a note with your name so we can thank you.</p>
        </div>
      </div>

      <div class="payment-card">
        <div class="payment-header">
          <span class="payment-icon">🏦</span>
          <h3>GoTyme</h3>
        </div>
        <div class="payment-body">
          <p>Send your donation via GoTyme Bank:</p>
          <p class="payment-info">
            <strong>Account Name:</strong> [Your GoTyme Account Name Here]<br>
            <strong>Account Number:</strong> [Your GoTyme Account Number Here]
          </p>
        </div>
      </div>

    </div>
  </div>

  <div class="donation-form-section">
    <h2>Let Us Know Your Gift</h2>
    <p>After donating, please fill out this form so we can acknowledge and pray for you.</p>

    <form id="donationForm" class="donation-form">
      <div class="form-group">
        <label for="donorName">Your Name *</label>
        <input type="text" id="donorName" name="name" required placeholder="e.g. Juan Dela Cruz">
      </div>

      <div class="form-group">
        <label for="donorEmail">Your Email *</label>
        <input type="email" id="donorEmail" name="email" required placeholder="you@email.com">
      </div>

      <div class="form-group">
        <label for="donationAmount">Amount (₱) *</label>
        <input type="number" id="donationAmount" name="amount" min="1" required placeholder="e.g. 500">
      </div>

      <div class="form-group">
        <label>Donation Type *</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="type" value="one-time" checked>
            <span>One-Time</span>
          </label>
          <label class="radio-label">
            <input type="radio" name="type" value="recurring">
            <span>Recurring (Monthly)</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="paymentMethod">Payment Method *</label>
        <select id="paymentMethod" name="paymentMethod" required>
          <option value="">Select one...</option>
          <option value="gcash">GCash</option>
          <option value="gotyme">GoTyme</option>
        </select>
      </div>

      <div class="form-group">
        <label for="donationMessage">Message / Prayer Request</label>
        <textarea id="donationMessage" name="message" rows="4" placeholder="Any message or prayer request..."></textarea>
      </div>

      <p class="form-disclaimer">This form sends us your donation info. After submitting, please send the amount through your chosen payment method above.</p>

      <button type="submit" class="btn btn-primary btn-submit">Submit Donation Info</button>
    </form>

    <div id="donationSuccess" class="success-message" style="display:none;">
      <p>✅ Thank you! Your donation information has been received. We will acknowledge it soon. May God bless you abundantly!</p>
    </div>
  </div>

  <div class="donate-thanks">
    <blockquote>
      <p>"Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver."</p>
      <cite>— 2 Corinthians 9:7</cite>
    </blockquote>
  </div>
</section>
