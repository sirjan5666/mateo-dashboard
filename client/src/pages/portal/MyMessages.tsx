import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { getPortalMe, getPortalMessages, sendPortalMessage } from '../../api/portal';
import { BrandTile } from '../../components/ui/BrandTile';
import { Card } from '../../components/ui/Card';
import { MessageThread } from '../../components/MessageThread';
import type { ThreadMessage } from '../../components/MessageThread';

export default function MyMessages() {
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [doctorName, setDoctorName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPortalMessages()
      .then((d) => !cancelled && setMessages(d.messages))
      .catch(() => !cancelled && setMessages([]));
    getPortalMe()
      .then((d) => !cancelled && setDoctorName(d.doctor?.name ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSend(body: string) {
    const { message } = await sendPortalMessage(body);
    setMessages((prev) => [...(prev ?? []), message]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="flex items-center gap-3">
        <BrandTile icon={MessageSquare} iconClassName="h-6 w-6" className="h-12 w-12 rounded-2xl shadow-soft" />
        <div>
          <p className="eyebrow">Messages</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">
            {doctorName ? `Chat with Dr. ${doctorName}` : 'Your care team'}
          </h1>
          <p className="text-sm text-stone-500">Secure, encrypted messages with your doctor.</p>
        </div>
      </header>

      <Card className="mt-5 p-5 sm:p-6">
        <MessageThread messages={messages} onSend={onSend} emptyHint="No messages yet. Say hello to your care team." />
      </Card>
    </div>
  );
}
