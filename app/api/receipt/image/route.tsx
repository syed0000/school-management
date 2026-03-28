import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { format } from 'date-fns';
import { schoolConfig } from '@/lib/config';

export const runtime = 'edge';

// Reliable, verified Font CDN URL (jsDelivr)
const FONT_URL = 'https://cdn.jsdelivr.net/npm/notosans-fontface@1.3.0/fonts/NotoSans-Regular.ttf';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const receiptNumber = searchParams.get('receiptNumber') || 'N/A';
        const origin = request.nextUrl.origin;

        // Load Font from stable CDN
        let fontData: ArrayBuffer | null = null;
        try {
            const fontRes = await fetch(FONT_URL);
            if (fontRes.ok) {
                const contentType = fontRes.headers.get('content-type') || '';
                if (!contentType.includes('html')) {
                    fontData = await fontRes.arrayBuffer();
                }
            }
        } catch (e) {
            console.error('Error fetching font:', e);
        }

        // Satori requires at least one font
        if (!fontData) {
            return new Response('Error: Font loading failed.', { status: 500 });
        }

        const studentName = searchParams.get('studentName') || 'Unknown';
        const studentRegNo = searchParams.get('studentRegNo') || 'N/A';
        const rollNumber = searchParams.get('rollNumber') || 'N/A';
        const className = searchParams.get('className') || 'N/A';
        const section = searchParams.get('section') || 'A';
        const amountStr = searchParams.get('amount') || '0';
        const amount = parseFloat(amountStr);
        const dateStr = searchParams.get('date') || new Date().toISOString();
        const date = new Date(dateStr);
        const feeType = searchParams.get('feeType') || 'Fee Payment';
        const monthsParam = searchParams.get('months') || searchParams.get('period'); // Support both 'months' and 'period'
        const yearStr = searchParams.get('year');

        // Format fee description
        let feeDescription = 'Fee Payment';
        const year = yearStr ? parseInt(yearStr) : date.getFullYear();

        if (monthsParam) {
            // Favor the detailed string from the collection action (e.g. "Apr, May, Admission")
            feeDescription = monthsParam;
        } else if (feeType === 'monthly') {
            feeDescription = `Monthly Fee - ${format(date, 'MMM yyyy')}`;
        } else if (feeType !== 'Multiple Fees' && feeType !== 'Fee Payment') {
            // For single non-monthly payments like "admission"
            feeDescription = feeType.charAt(0).toUpperCase() + feeType.slice(1) + ` (${year})`;
        }

        return new ImageResponse(
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
                    {/* Header - Text-only optimization */}
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

                    {/* Receipt Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '16px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Receipt# {receiptNumber}</span>
                            <span>{format(date, 'dd MMM yyyy')}</span>
                        </div>
                    </div>

                    {/* Student Info */}
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

                    {/* Fee Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '18px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold' }}>Description</span>
                            <span style={{ fontWeight: 'bold' }}>Amount</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                            <span style={{ fontSize: '16px', maxWidth: '75%', overflow: 'hidden' }}>{feeDescription}</span>
                            <span>₹{amount.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Total */}
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

                    {/* Hindi Notes */}
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

                    {/* Footer */}
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
            ),
            {
                width: 800,
                height: 800,
                fonts: [
                    { name: 'Noto Sans', data: fontData, style: 'normal' as const },
                ],
                headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=31536000, immutable',
                }
            }
        );
    } catch (error) {
        console.error('Error generating receipt image:', error);
        return new Response('Error rendering image', { status: 500 });
    }
}
