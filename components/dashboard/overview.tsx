"use client"

import { ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from "recharts"

interface OverviewProps {
  data: {
    name: string
    collected: number
    pending: number
    unpaid: number
    expense: number
    profit: number
  }[]
}

export function Overview({ data }: OverviewProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `₹${value}`}
        />
        <Tooltip 
            cursor={{ stroke: '#888888', strokeWidth: 1 }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        />
        <Legend />
        
        {/* Income (Collected) - Green */}
        <Line
          type="monotone"
          dataKey="collected"
          name="Income"
          stroke="#16a34a" 
          strokeWidth={2}
          dot={{ r: 4, fill: "#16a34a", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
        
        {/* Expense - Red */}
        <Line
          type="monotone"
          dataKey="expense"
          name="Expense"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 4, fill: "#ef4444", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
        
        {/* Profit/Loss - Yellow */}
        <Line
          type="monotone"
          dataKey="profit"
          name="Profit/Loss"
          stroke="#eab308"
          strokeWidth={2}
          dot={{ r: 4, fill: "#eab308", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
