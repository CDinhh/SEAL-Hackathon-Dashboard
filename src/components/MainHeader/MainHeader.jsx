import React from 'react'
import logo_fpt from '../../assets/logo-fpt.png'
import Clock from '../CountdownClock.jsx'

const MainHeader = () => {
    return (
        <header className="absolute top-0 left-0 w-full z-50 grid grid-cols-3 p-5 pointer-events-none">
            <div className="col-span-1 pointer-events-auto">
                <div className="flex flex-rol justify-start">
                    {/* Logo with futuristic glow */}
                    <img
                        src={logo_fpt}
                        alt="logo"
                        className='w-64 h-auto drop-shadow-lg filter brightness-110'
                    />
                </div>
            </div>
            {/* Cột giữa rỗng để đẩy cột Đồng hồ sang tít bên phải */}
            <div className="col-span-1"></div>

            <div className="col-span-1 flex justify-end pointer-events-auto">
                <Clock />
            </div>
        </header>
    )
}

export default MainHeader
