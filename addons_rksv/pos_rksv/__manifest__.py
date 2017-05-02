# -*- coding: utf-8 -*-
{
    'name': 'Registrierkasse Österreich',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Registrierkassenpflicht Modul für Österreich',
    'website': 'https://github.com/Odoo-Austria',
    'author': 'Wolfgang Pichler (Callino), WT-IO-IT GmbH, Wolfgang Taferner',
    'license': "Other proprietary",
    'description': """
Registrierkasse Österreich
==================================

Registrierkassen Modul für die Anforderungen der Österreichischen Registrierkassenpflicht
""",
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
