# -*- coding: utf-8 -*-
{
    'name': 'Registrierkasse Österreich',
    'version': '10.0.0.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Registrierkassenpflicht Modul für Österreich',
    'website': 'https://www.callino.at/page/rksv',
    'description': """
Registrierkasse Österreich
==================================

Registrierkassen Modul für die Anforderungen der Österreichischen Registrierkassenpflicht
""",
    'author': 'Wolfgang Pichler (Callino), Wolfgang Taferner (WT-IO-IT GmbH)',
    'depends': ['point_of_sale', 'pos_product_reference'],
    'test': [
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/signature_provider.xml',
        'views/pos_config.xml',
        'views/pos_order.xml',
        'views/res_company.xml',
        'views/account.xml',
        'views/product.xml',
        'views/templates.xml',
        'data/data.xml'
    ],
    'qweb': [
        'static/src/xml/receipt.xml',
        'static/src/xml/rksv.xml'
    ],
    'installable': True,
    'auto_install': False,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
