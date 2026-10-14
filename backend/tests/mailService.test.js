const mockSendMail = jest.fn().mockResolvedValue({});

jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: mockSendMail }),
  getTestMessageUrl: () => false,
}));

function loadMailService(mailEnabled) {
  jest.resetModules();
  if (mailEnabled === undefined) delete process.env.MAIL_ENABLED;
  else process.env.MAIL_ENABLED = mailEnabled;
  return require('../mailService');
}

describe('mailService MAIL_ENABLED', () => {
  const originalEnv = process.env.MAIL_ENABLED;

  beforeEach(() => {
    mockSendMail.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.MAIL_ENABLED;
    else process.env.MAIL_ENABLED = originalEnv;
  });

  it('未設定時照常寄信', async () => {
    const { sendBookingConfirmation } = loadMailService(undefined);
    await sendBookingConfirmation('user@example.com', { roomName: 'A', date: '2026-01-01', startTime: '09:00', endTime: '10:00' });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].to).toBe('user@example.com');
  });

  it('MAIL_ENABLED=false 時不寄信', async () => {
    const { sendBookingConfirmation, sendRoomPassword } = loadMailService('false');
    await sendBookingConfirmation('user@example.com', { roomName: 'A', date: '2026-01-01', startTime: '09:00', endTime: '10:00' });
    await sendRoomPassword('user@example.com', 'A', '123456');
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
