// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('active');
      toggle.classList.toggle('active');
    });
  }

  // Handle donation form submission via FormSubmit or mailto fallback
  const donateForm = document.getElementById('donationForm');
  if (donateForm) {
    donateForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const name = document.getElementById('donorName').value.trim();
      const email = document.getElementById('donorEmail').value.trim();
      const amount = document.getElementById('donationAmount').value;
      const type = document.querySelector('input[name="type"]:checked').value;
      const method = document.getElementById('paymentMethod').value;
      const message = document.getElementById('donationMessage').value.trim();

      const subject = encodeURIComponent(`Donation from ${name}`);
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nAmount: ₱${amount}\nType: ${type}\nPayment: ${method}\nMessage: ${message}`
      );

      window.location.href = `mailto:biblestudycenter.ph@gmail.com?subject=${subject}&body=${body}`;

      donateForm.style.display = 'none';
      document.getElementById('donationSuccess').style.display = 'block';
    });
  }

  // Handle contact form
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const subject = document.getElementById('contactSubject').value.trim() || 'Message';
      const message = document.getElementById('contactMessage').value.trim();

      const mailSubject = encodeURIComponent(`[BSC] ${subject} from ${name}`);
      const mailBody = encodeURIComponent(
        `From: ${name}\nEmail: ${email}\n\n${message}`
      );

      window.location.href = `mailto:biblestudycenter.ph@gmail.com?subject=${mailSubject}&body=${mailBody}`;

      contactForm.style.display = 'none';
      document.getElementById('contactSuccess').style.display = 'block';
    });
  }
});
