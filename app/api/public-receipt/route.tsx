import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { format } from 'date-fns';
import { schoolConfig } from '@/lib/config';

const FONT_URL = 'https://cdn.jsdelivr.net/npm/notosans-fontface@1.3.0/fonts/NotoSans-Regular.ttf';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const receiptNumber = searchParams.get('receiptNumber') || 'N/A';
        const studentName = searchParams.get('studentName') || 'Unknown';
        const studentRegNo = searchParams.get('studentRegNo') || 'N/A';
        const rollNumber = searchParams.get('rollNumber') || 'N/A';
        const className = searchParams.get('className') || 'N/A';
        const section = searchParams.get('section') || 'A';
        const amountStr = searchParams.get('amount') || '0';
        const amount = parseFloat(amountStr) || 0;
        const dateStr = searchParams.get('date');
        const date = dateStr ? new Date(dateStr) : new Date();
        const feeType = searchParams.get('feeType') || 'Fee Payment';
        const monthsParam = searchParams.get('months');
        const year = searchParams.get('year') || date.getFullYear().toString();
        const remarks = searchParams.get('remarks') || '';

        // Load Font from stable CDN
        let fontData: ArrayBuffer | null = null;
        try {
            const fontRes = await fetch(FONT_URL, { cache: 'force-cache' });
            if (fontRes.ok) {
                const contentType = fontRes.headers.get('content-type') || '';
                if (!contentType.includes('html')) {
                    fontData = await fontRes.arrayBuffer();
                }
            }
        } catch (e) {
            console.error('Error fetching font:', e);
        }

        if (!fontData) {
            return new Response('Error: Font loading failed.', { status: 500 });
        }

        // Format fee description
        let feeDescription = 'Fee Payment';
        if (monthsParam) {
            feeDescription = monthsParam;
        } else if (feeType === 'monthly') {
            feeDescription = `Monthly Fee - ${format(date, 'MMM yyyy')}`;
        } else if (feeType !== 'Multiple Fees' && feeType !== 'Fee Payment') {
            feeDescription = feeType.charAt(0).toUpperCase() + feeType.slice(1) + ` (${year})`;
        }

        const imageResponse = new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'white',
                        padding: '30px 40px',
                        fontFamily: '"Noto Sans", sans-serif',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', textAlign: 'center', color: '#111' }}>
                            {schoolConfig.name}
                        </h1>
                        <p style={{
                            fontSize: '18px',
                            marginTop: '8px',
                            borderBottom: '2px solid #000',
                            paddingBottom: '2px',
                            fontWeight: 'bold'
                        }}>FEE RECEIPT</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '16px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Receipt# {receiptNumber}</span>
                            <span>{format(date, 'dd MMM yyyy')}</span>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontSize: '18px',
                        marginBottom: '15px',
                        backgroundColor: '#f9f9f9',
                        padding: '12px 15px',
                        borderRadius: '8px',
                        border: '1px solid #eee'
                    }}>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '160px' }}>Student:</span>
                            <span>{studentName}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '160px' }}>Reg ID / Roll:</span>
                            <span>{studentRegNo} / {rollNumber}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                            <span style={{ fontWeight: 'bold', width: '160px' }}>Class / Sec:</span>
                            <span>{className} - {section}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '18px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold' }}>Description</span>
                            <span style={{ fontWeight: 'bold' }}>Amount</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '16px', maxWidth: '75%', overflow: 'hidden' }}>{feeDescription}</span>
                                <span>₹{amount.toLocaleString()}</span>
                            </div>
                            {remarks && (
                                <span style={{ fontSize: '14px', color: '#555', fontStyle: 'italic', marginTop: '4px', borderLeft: '2px solid #ccc', paddingLeft: '6px' }}>
                                    "{remarks}"
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        marginTop: '15px',
                        borderTop: '2px solid black',
                        paddingTop: '10px',
                        color: '#000'
                    }}>
                        <span>TOTAL PAID</span>
                        <span>₹{amount.toLocaleString()}</span>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        marginBottom: '10px',
                        alignItems: 'flex-start',
                        marginTop: '25px',
                        fontSize: '14px',
                        color: '#444',
                        lineHeight: '1.4'
                    }}>
                        <p style={{ margin: 0 }}>• कृपया समय पर फीस जमा करें</p>
                        <p style={{ margin: 0 }}>• कृपया फीस जमा करते समय डायरी साथ लाएं</p>
                        <p style={{ margin: 0 }}>• कृपया बच्चे की पढ़ाई में सहयोग करें</p>
                        <p style={{ margin: 0 }}>• बच्चे को नियमित और समय पर स्कूल भेजें</p>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        marginTop: 'auto',
                        fontSize: '12px',
                        color: '#666',
                        textAlign: 'center',
                        borderTop: '1px dashed #ccc',
                        paddingTop: '10px',
                        paddingBottom: '5px'
                    }}>
                        <p style={{ fontWeight: 'bold', margin: '0 0 2px 0' }}>Thank You!</p>
                        <p style={{ margin: 0 }}>Generated via FeeEase System | feeease.com</p>
                    </div>
                </div>
            ) as any,
            {
                width: 800,
                height: 800,
                fonts: [
                    { name: 'Noto Sans', data: fontData, style: 'normal' as const },
                ],
            }
        );

        const imageBuffer = await imageResponse.arrayBuffer();
        const uint8Array = new Uint8Array(imageBuffer);

        return new Response(uint8Array, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': uint8Array.length.toString(),
                'Content-Disposition': `attachment; filename="receipt-${receiptNumber}.png"`,
                'Cache-Control': 'public, max-age=3600',
            }
        });
    } catch (error) {
        console.error('Error generating receipt image:', error);
        return new Response('Error rendering image', { status: 500 });
    }
}
