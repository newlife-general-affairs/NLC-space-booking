const SuspensionCheckBlock = require('../blocks/SuspensionCheckBlock');
const BookingError = require('../blocks/BookingError');
const { isPastoralZoneSuspended } = require('../violationsStore');

jest.mock('../violationsStore', () => ({
  isPastoralZoneSuspended: jest.fn(),
}));

describe('SuspensionCheckBlock', () => {
  let block;

  beforeEach(() => {
    block = new SuspensionCheckBlock();
    jest.clearAllMocks();
  });

  it('should pass if user is admin, even if pastoral zone is suspended', async () => {
    isPastoralZoneSuspended.mockResolvedValue(true);

    const context = {
      slots: [{ date: '2026-08-01' }],
      user: { role: 'admin' },
      cleanFields: { pastoralZone: 'Suspended Zone' }
    };

    await expect(block.execute(context)).resolves.not.toThrow();
    expect(isPastoralZoneSuspended).not.toHaveBeenCalled();
  });

  it('should throw Forbidden BookingError if user is regular user and pastoral zone is suspended', async () => {
    isPastoralZoneSuspended.mockResolvedValue(true);

    const context = {
      slots: [{ date: '2026-08-01' }],
      user: { role: 'user' },
      cleanFields: { pastoralZone: 'Suspended Zone' }
    };

    await expect(block.execute(context)).rejects.toThrow(
      /次月資格已取消，無法新增此月份/
    );
    expect(isPastoralZoneSuspended).toHaveBeenCalledWith('Suspended Zone', '2026-08-01');
  });

  it('should pass if user is regular user and pastoral zone is not suspended', async () => {
    isPastoralZoneSuspended.mockResolvedValue(false);

    const context = {
      slots: [{ date: '2026-08-01' }],
      user: { role: 'user' },
      cleanFields: { pastoralZone: 'Active Zone' }
    };

    await expect(block.execute(context)).resolves.not.toThrow();
    expect(isPastoralZoneSuspended).toHaveBeenCalledWith('Active Zone', '2026-08-01');
  });
});
