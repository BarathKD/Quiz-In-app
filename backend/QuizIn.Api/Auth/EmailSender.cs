using System.Net;
using System.Net.Mail;

namespace QuizIn.Api.Auth;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body);
}

// Real e-mail through any SMTP service (Brevo, Gmail app password, Mailjet...). Set Email:Host, Port, User, Password, From.
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    public SmtpEmailSender(IConfiguration config) => _config = config;

    public async Task SendAsync(string to, string subject, string body)
    {
        var host = _config["Email:Host"]!;
        var port = int.TryParse(_config["Email:Port"], out var p) ? p : 587;
        var from = _config["Email:From"] is { Length: > 0 } f ? f : _config["Email:User"]!;
        var fromName = _config["Email:FromName"] is { Length: > 0 } n ? n : "Quiz-IN";

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(_config["Email:User"], _config["Email:Password"]),
        };
        using var message = new MailMessage { From = new MailAddress(from, fromName), Subject = subject, Body = body };
        message.To.Add(to);
        await client.SendMailAsync(message);
    }
}

// Used when no SMTP server is configured (local development): the message is only written to the log.
public class LogEmailSender : IEmailSender
{
    private readonly ILogger<LogEmailSender> _log;
    public LogEmailSender(ILogger<LogEmailSender> log) => _log = log;

    public Task SendAsync(string to, string subject, string body)
    {
        _log.LogWarning("E-mail is not configured. Would send to {To}: {Subject} | {Body}", to, subject, body);
        return Task.CompletedTask;
    }
}
