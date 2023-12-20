import nodemailer from "nodemailer";

const welcomeTemplate = `<div style="padding: 35px; max-width: 600px; min-height: 400px;">
<table cellpadding="0" align="center"
  style="width: 600px; margin: 0px auto; text-align: left; position: relative; border-top-left-radius: 5px; border-top-right-radius: 5px; border-bottom-right-radius: 5px; border-bottom-left-radius: 5px; font-size: 14px; font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.5; box-shadow: rgb(153, 153, 153) 0px 0px 5px; border-collapse: collapse; background-position: initial initial; background-repeat: initial initial;background:#fff;">
  <tbody>
    <tr>
      <th valign="middle"
        style="height: 25px; line-height: 25px; padding: 15px 35px; border-bottom-width: 1px; border-bottom-style: solid; border-bottom-color: #C46200; background-color: #FEA138; border-top-left-radius: 5px; border-top-right-radius: 5px; border-bottom-right-radius: 0px; border-bottom-left-radius: 0px;">
        <font face="'Microsoft YaHei', Arial, sans-serif" size="5" style="color: rgb(255, 255, 255); ">For fun via AI.</font>
      </th>
    </tr>
    <tr>
      <td>
        <div style="padding:25px 35px 40px; background-color:#fff;">
          <h2 style="margin: 5px 0px; ">
            <font color="#333333" style="line-height: 20px; ">
              <font style="line-height: 22px; " size="4">Dear {{email}}:</font>
            </font>
          </h2>
          <p>We have just received your login/registration request. Please fill in the verification code promptly:</p>
          <p>The verification code will expire in 5 minutes, so please complete the verification as soon as possible.</p>
          <h2 style="margin: 5px 0px; ">
            <font color="#333333" style="line-height: 20px; ">
              <font style="line-height: 22px; " size="4">{{code}}</font>
            </font>
          </h2>
        </div>
      </td>
    </tr>
  </tbody>
</table>
</div>`;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
});

const mailOptions = {
  from: process.env.SMTP_FROM || "My Site <" + process.env.SMTP_USERNAME + ">",
};

/**
 * Email template insert sytax: {{}} replace with the value.
 * @param {string} template
 * @param {object} data
 * @returns {string}
 */
function renderTemplate(
  template: string,
  data: { [s: string]: any } | ArrayLike<unknown>,
): string {
  const keys = Object.keys(data);
  const values = Object.values(data);
  let result = template;
  for (let i = 0; i < keys.length; i++) {
    result = result.replace(new RegExp(`{{${keys[i]}}}`, "g"), values[i]);
  }
  return result;
}

/**
 * Send a code to the user's email.
 * @param {string} email
 * @param {number} code
 * @returns {Promise}
 */
export async function sendVerificationEmail(
  email: string,
  code: number,
): Promise<any> {
  // render the template
  const html = renderTemplate(welcomeTemplate, {
    email: email,
    code: code,
  });

  // send the email
  return transporter.sendMail({
    ...mailOptions,
    to: email,
    subject: `[${code}] - Verification code for login/registration`,
    html,
  });
}
