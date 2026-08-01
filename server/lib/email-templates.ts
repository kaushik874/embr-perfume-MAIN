export function baseTemplate(title: string, content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f7f7f5;
      color: #1a1a1a;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e5e5e5;
    }
    .header {
      text-align: center;
      padding: 30px;
      border-bottom: 1px solid #e5e5e5;
    }
    .header h1 {
      margin: 0;
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      font-weight: normal;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #1a1a1a;
    }
    .content {
      padding: 40px 30px;
    }
    .footer {
      text-align: center;
      padding: 30px;
      background-color: #1a1a1a;
      color: #f7f7f5;
      font-size: 12px;
      letter-spacing: 0.05em;
    }
    .footer a {
      color: #f7f7f5;
      text-decoration: underline;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #1a1a1a;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 20px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    .data-table th, .data-table td {
      padding: 12px 0;
      border-bottom: 1px solid #e5e5e5;
      text-align: left;
    }
    .data-table th {
      font-weight: 500;
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>EMBR</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Crafted in shadow. Worn in light.</p>
      <p>&copy; ${new Date().getFullYear()} Embr Perfume. All rights reserved.</p>
      <p>Need help? Contact <a href="mailto:support@embrperfume.com">support@embrperfume.com</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

export function otpEmail(otp: string) {
  const content = `
    <h2 style="font-family: 'Playfair Display', serif; font-weight: normal; margin-top: 0;">Verify your Email</h2>
    <p>Please use the verification code below to complete your request. This code is valid for <strong>5 minutes</strong>.</p>
    
    <div style="text-align: center; margin: 40px 0;">
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 0.3em; background-color: #f7f7f5; padding: 20px; display: inline-block; border-radius: 4px;">
        ${otp}
      </div>
    </div>
    
    <p>If you didn't request this code, you can safely ignore this email.</p>
  `;
  return baseTemplate("Verify your Email - Embr Perfume", content);
}

export function welcomeEmail(name: string) {
  const content = `
    <h2 style="font-family: 'Playfair Display', serif; font-weight: normal; margin-top: 0;">Welcome to Embr, ${name}</h2>
    <p>We're thrilled to have you join our world. Embr was founded on the belief that fragrance should be felt before it is smelled — a presence, a memory, a whisper that lingers.</p>
    <p>As a member, you'll be the first to know about new releases, exclusive collections, and private events.</p>
    <div style="text-align: center; margin-top: 40px;">
      <a href="${process.env.CLIENT_URL || 'https://embrperfume.com'}" class="btn">Discover Our Collection</a>
    </div>
  `;
  return baseTemplate("Welcome to Embr Perfume", content);
}

export function passwordResetSuccessEmail() {
  const content = `
    <h2 style="font-family: 'Playfair Display', serif; font-weight: normal; margin-top: 0;">Password Reset Successful</h2>
    <p>Your password has been successfully updated. You can now use your new password to sign in to your account.</p>
    <p>If you did not make this change, please contact our support team immediately.</p>
  `;
  return baseTemplate("Password Reset Successful", content);
}

export function orderConfirmationEmail(order: any, items: any[]) {
  const itemsHtml = items.map(item => `
    <tr>
      <td>
        <strong>${item.name || item.product_name}</strong><br>
        <span style="color: #666; font-size: 13px;">Qty: ${item.quantity}</span>
      </td>
      <td style="text-align: right;">INR ${(item.price_at_time || item.price_paise) / 100}</td>
    </tr>
  `).join('');

  const content = `
    <h2 style="font-family: 'Playfair Display', serif; font-weight: normal; margin-top: 0;">Order Confirmed</h2>
    <p>Thank you for your purchase. We've received your order and are currently processing it.</p>
    
    <p><strong>Order Number:</strong> #${order.id}<br>
    <strong>Date:</strong> ${new Date(order.created_at || Date.now()).toLocaleDateString()}</p>

    <h3 style="font-family: 'Playfair Display', serif; font-weight: normal; margin-top: 40px;">Order Summary</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: right;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td style="padding-top: 20px; font-weight: bold;">Grand Total</td>
          <td style="text-align: right; padding-top: 20px; font-weight: bold;">INR ${order.total_paise / 100}</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
      <h3 style="font-family: 'Playfair Display', serif; font-weight: normal; font-size: 16px;">Shipping Address</h3>
      <p style="color: #666; font-size: 14px;">
        ${order.shipping_name}<br>
        ${[
          order.shipping_house_number, 
          order.shipping_street, 
          order.shipping_area, 
          order.shipping_city, 
          order.shipping_state, 
          order.shipping_pincode
        ].filter(Boolean).join(', ')}
      </p>
    </div>
  `;
  return baseTemplate(`Order #${order.id} Confirmed - Embr Perfume`, content);
}

export function orderStatusEmail(order: any, status: string) {
  const statusMessages: Record<string, string> = {
    'shipped': 'Your order has been shipped and is on its way to you.',
    'delivered': 'Your order has been delivered. We hope you enjoy your new fragrance.',
    'cancelled': 'Your order has been cancelled as requested.',
  };
  
  const message = statusMessages[status] || `Your order status has been updated to: ${status}.`;

  const content = `
    <h2 style="font-family: 'Playfair Display', serif; font-weight: normal; margin-top: 0; text-transform: capitalize;">Order ${status}</h2>
    <p>${message}</p>
    <p><strong>Order Number:</strong> #${order.id}</p>
    
    ${order.tracking_number ? `<p><strong>Tracking Number:</strong> ${order.tracking_number}</p>` : ''}
    
    <div style="text-align: center; margin-top: 40px;">
      <a href="${process.env.CLIENT_URL || 'https://embrperfume.com'}/account" class="btn">View Order History</a>
    </div>
  `;
  return baseTemplate(`Order #${order.id} Update: ${status.toUpperCase()}`, content);
}
