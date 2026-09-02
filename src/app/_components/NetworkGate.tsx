'use client';

import { useEffect, useState } from 'react';
import Modal from '~/components/ui/Modal';
import NetworkSwitcher from '~/components/NetworkSwitcher';
import { useSupportedChainGuard } from '~/hooks/useSupportedChainGuard';

export default function NetworkGate() {
  const { requiresSwitch } = useSupportedChainGuard();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (requiresSwitch) setIsOpen(true);
  }, [requiresSwitch]);

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <NetworkSwitcher />
    </Modal>
  );
}
